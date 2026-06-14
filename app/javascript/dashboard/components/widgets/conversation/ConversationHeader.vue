<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useElementSize } from '@vueuse/core';
import { useMapGetter } from 'dashboard/composables/store';
import BackButton from '../BackButton.vue';
import InboxName from '../InboxName.vue';
import MoreActions from './MoreActions.vue';
import Avatar from 'next/avatar/Avatar.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import AddLabel from 'shared/components/ui/dropdown/AddLabel.vue';
import LabelDropdown from 'shared/components/ui/label/LabelDropdown.vue';
import wootConstants from 'dashboard/constants/globals';
import { conversationListPageURL } from 'dashboard/helper/URLHelper';
import { snoozedReopenTime } from 'dashboard/helper/snoozeHelpers';
import { useInbox } from 'dashboard/composables/useInbox';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useConversationLabels } from 'dashboard/composables/useConversationLabels';
import { useI18n } from 'vue-i18n';
import { copyTextToClipboard } from 'shared/helpers/clipboard';
import { useAlert } from 'dashboard/composables';
import {
  FOLLOW_UP_ACTIONS,
  SALES_LABELS,
  SALES_STAGE_ACTIONS,
  getSnoozeDate,
} from 'dashboard/helper/salesWorkspace';

const props = defineProps({
  chat: {
    type: Object,
    default: () => ({}),
  },
  showBackButton: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();
const store = useStore();
const route = useRoute();
const conversationHeader = ref(null);
const showSearchDropdownLabel = ref(false);
const { width } = useElementSize(conversationHeader);
const { isAWebWidgetInbox } = useInbox();
const { isAdmin } = useAdmin();
const {
  savedLabels,
  activeLabels,
  accountLabels,
  addLabelToConversation,
  removeLabelFromConversation,
} = useConversationLabels();

const currentChat = computed(() => store.getters.getSelectedChat);
const currentUser = useMapGetter('getCurrentUser');
const accountId = computed(() => store.getters.getCurrentAccountId);

const chatMetadata = computed(() => props.chat.meta);

const backButtonUrl = computed(() => {
  const {
    params: { inbox_id: inboxId, label, teamId, id: customViewId },
    name,
  } = route;

  const conversationTypeMap = {
    conversation_through_mentions: 'mention',
    conversation_through_participating: 'participating',
    conversation_through_unattended: 'unattended',
  };
  return conversationListPageURL({
    accountId: accountId.value,
    inboxId,
    label,
    teamId,
    conversationType: conversationTypeMap[name],
    customViewId,
  });
});

const isHMACVerified = computed(() => {
  if (!isAWebWidgetInbox.value) {
    return true;
  }
  return chatMetadata.value.hmac_verified;
});

const currentContact = computed(() =>
  store.getters['contacts/getContact'](props.chat.meta.sender.id)
);
const rawContactPhoneNumber = computed(
  () =>
    currentContact.value?.phone_number ||
    currentContact.value?.phoneNumber ||
    props.chat?.meta?.sender?.phone_number ||
    props.chat?.meta?.sender?.phoneNumber ||
    ''
);
const contactPhoneNumber = computed(() => {
  const phoneNumber = String(rawContactPhoneNumber.value || '');
  const digits = phoneNumber.replace(/\D/g, '');
  const nationalDigits =
    digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;

  if (nationalDigits.length === 11) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(
      2,
      7
    )}-${nationalDigits.slice(7)}`;
  }

  if (nationalDigits.length === 10) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(
      2,
      6
    )}-${nationalDigits.slice(6)}`;
  }

  return phoneNumber;
});

const isSnoozed = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.SNOOZED
);

const snoozedDisplayText = computed(() => {
  const { snoozed_until: snoozedUntil } = currentChat.value;
  if (snoozedUntil) {
    return `${t('CONVERSATION.HEADER.SNOOZED_UNTIL')} ${snoozedReopenTime(snoozedUntil)}`;
  }
  return t('CONVERSATION.HEADER.SNOOZED_UNTIL_NEXT_REPLY');
});

const inbox = computed(() => {
  const { inbox_id: inboxId } = props.chat;
  return store.getters['inboxes/getInbox'](inboxId);
});

const hasMultipleInboxes = computed(
  () => store.getters['inboxes/getInboxes'].length > 1
);

const hasSlaPolicyId = computed(() => props.chat?.sla_policy_id);

const assignedAgent = computed({
  get() {
    return currentChat.value?.meta?.assignee;
  },
  set(agent) {
    const agentId = agent ? agent.id : null;
    store.dispatch('setCurrentChatAssignee', {
      conversationId: currentChat.value?.id,
      assignee: agent,
    });
    store.dispatch('assignAgent', {
      conversationId: currentChat.value?.id,
      agentId,
    });
  },
});

const isAssignedToCurrentUser = computed(
  () => assignedAgent.value?.id === currentUser.value?.id
);

const showSelfAssignAction = computed(
  () => !!currentUser.value?.id && !isAssignedToCurrentUser.value
);

const activeSalesStage = computed(() =>
  SALES_STAGE_ACTIONS.find(action => savedLabels.value.includes(action.id))
);

const updateConversationLabels = labels => {
  store.dispatch('conversationLabels/update', {
    conversationId: currentChat.value?.id,
    labels,
  });
};

const setSalesLabel = labelTitle => {
  const salesStageLabels = SALES_STAGE_ACTIONS.map(action => action.id);
  const nextLabels = savedLabels.value.filter(
    label => !salesStageLabels.includes(label)
  );

  if (!nextLabels.includes(labelTitle)) {
    nextLabels.push(labelTitle);
  }

  updateConversationLabels(nextLabels);
};

const selfAssignConversation = async () => {
  const { avatar_url: avatarUrl, ...rest } = currentUser.value || {};
  assignedAgent.value = { ...rest, thumbnail: avatarUrl };
  useAlert(t('CONVERSATION.CHANGE_AGENT'));
};

const scheduleFollowUp = action => {
  const nextLabels = savedLabels.value.includes(SALES_LABELS.FOLLOW_UP)
    ? savedLabels.value
    : [...savedLabels.value, SALES_LABELS.FOLLOW_UP];

  updateConversationLabels(nextLabels);
  store.dispatch('toggleStatus', {
    conversationId: currentChat.value?.id,
    status: wootConstants.STATUS_TYPE.SNOOZED,
    snoozedUntil: getSnoozeDate(action.hours),
  });
};

const copyPhoneNumber = async () => {
  if (!rawContactPhoneNumber.value) return;

  await copyTextToClipboard(rawContactPhoneNumber.value);
  useAlert(t('CONTACT_PANEL.COPY_SUCCESSFUL'));
};

const copyConversationId = async () => {
  try {
    await copyTextToClipboard(String(props.chat.id));
    useAlert(t('CONVERSATION.HEADER.COPY_ID_SUCCESS'));
  } catch (error) {
    // error
  }
};

const toggleLabels = () => {
  showSearchDropdownLabel.value = !showSearchDropdownLabel.value;
};

const closeDropdownLabel = () => {
  showSearchDropdownLabel.value = false;
};
</script>

<template>
  <div
    ref="conversationHeader"
    class="relative z-20 flex flex-col gap-3 items-center justify-between flex-1 w-full min-w-0 xl:flex-row px-4 py-3 min-h-24 xl:min-h-16 bg-white dark:bg-[#17120f] border-b border-[#ececf0] dark:border-[#2b211c]"
  >
    <div
      class="flex items-center justify-start w-full xl:w-auto max-w-full min-w-0 xl:flex-1"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="ltr:mr-2 rtl:ml-2"
      />
      <Avatar
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="32"
        :status="currentContact.availability_status"
        hide-offline-status
        rounded-full
      />
      <div class="flex flex-col items-start min-w-0 ml-2 rtl:ml-0 rtl:mr-2">
        <div
          class="flex flex-row flex-wrap items-center max-w-full gap-x-2 gap-y-1 p-0 m-0"
        >
          <span
            class="min-w-0 max-w-full text-sm font-semibold truncate leading-tight text-[#1f1f24] dark:text-[#fffaf4]"
          >
            {{ currentContact.name }}
          </span>
          <fluent-icon
            v-if="!isHMACVerified"
            v-tooltip="$t('CONVERSATION.UNVERIFIED_SESSION')"
            size="14"
            class="text-n-amber-10 my-0 mx-0 min-w-[14px] flex-shrink-0"
            icon="warning"
          />
        </div>

        <div
          class="flex items-center gap-1 overflow-hidden text-xs conversation--header--actions text-n-slate-11 text-ellipsis whitespace-nowrap"
        >
          <button
            type="button"
            class="truncate text-label-small text-[#7a7f89] hover:text-[#ff6a00] !p-0 cursor-pointer"
            @click="copyConversationId"
          >
            {{ `#${chat.id}` }}
          </button>
          <span
            v-if="contactPhoneNumber"
            aria-hidden="true"
            class="i-lucide-dot size-3 text-[#a3a7b0]"
          />
          <span
            v-if="contactPhoneNumber"
            class="inline-flex min-w-0 items-center gap-1 text-[#7a7f89]"
          >
            <span aria-hidden="true" class="i-lucide-phone size-3" />
            <span class="truncate">{{ contactPhoneNumber }}</span>
          </span>
          <span
            v-if="hasMultipleInboxes"
            aria-hidden="true"
            class="i-lucide-dot size-3 text-[#a3a7b0]"
          />
          <InboxName v-if="hasMultipleInboxes" :inbox="inbox" class="!mx-0" />
          <span
            v-if="isSnoozed"
            aria-hidden="true"
            class="i-lucide-dot size-3 text-[#a3a7b0]"
          />
          <span v-if="isSnoozed" class="font-medium text-n-amber-10">
            {{ snoozedDisplayText }}
          </span>
        </div>
        <div
          v-on-clickaway="closeDropdownLabel"
          class="relative mt-1 flex max-w-full flex-wrap items-center gap-1"
          @keyup.esc="closeDropdownLabel"
        >
          <AddLabel @add="toggleLabels" />
          <woot-label
            v-for="label in activeLabels"
            :key="label.id"
            :title="label.title"
            :description="label.description"
            show-close
            :color="label.color"
            variant="smooth"
            class="max-w-[9rem]"
            @remove="removeLabelFromConversation"
          />

          <div
            :class="{
              'block visible': showSearchDropdownLabel,
              'hidden invisible': !showSearchDropdownLabel,
            }"
            class="absolute top-full ltr:left-0 rtl:right-0 z-[10000] mt-2 w-72 rounded-lg border border-[#ffd0ad] bg-white p-2 shadow-xl dark:border-[#3a281f] dark:bg-[#211712]"
          >
            <LabelDropdown
              v-if="showSearchDropdownLabel"
              :account-labels="accountLabels"
              :selected-labels="savedLabels"
              :allow-creation="isAdmin"
              @add="addLabelToConversation"
              @remove="removeLabelFromConversation"
            />
          </div>
        </div>

        <div
          class="mt-2 flex max-w-full flex-wrap items-center gap-1.5 text-xs"
        >
          <button
            v-if="showSelfAssignAction"
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-full border border-[#ffd0ad] bg-[#fff7ef] px-2.5 font-semibold text-[#ff6a00] transition hover:bg-[#ffe7d4] dark:border-[#4a2b17] dark:bg-[#2a1b13]"
            @click="selfAssignConversation"
          >
            <span aria-hidden="true" class="i-lucide-user-check size-3.5" />
            <span>{{ t('CONVERSATION.ASSIGN_TO_ME') }}</span>
          </button>

          <button
            v-for="action in SALES_STAGE_ACTIONS"
            :key="action.id"
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-full border border-[#ececf0] bg-white px-2.5 font-medium text-[#6f747c] transition hover:border-[#ffd0ad] hover:bg-[#fff7ef] hover:text-[#ff6a00] dark:border-[#30251f] dark:bg-[#211712]"
            :class="{
              'border-[#ffb272] bg-[#fff1e5] text-[#ff6a00] dark:bg-[#321f12]':
                activeSalesStage?.id === action.id,
            }"
            @click="setSalesLabel(action.id)"
          >
            <span aria-hidden="true" :class="action.icon" class="size-3.5" />
            <span>{{ action.label }}</span>
          </button>

          <span
            class="hidden h-4 w-px bg-[#ececf0] dark:bg-[#3a281f] md:inline-flex"
          />

          <button
            v-for="action in FOLLOW_UP_ACTIONS"
            :key="action.id"
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-full bg-[#fff7ef] px-2.5 font-medium text-[#9a4b00] transition hover:bg-[#ffe7d4] dark:bg-[#2a1b13] dark:text-[#ffb272]"
            @click="scheduleFollowUp(action)"
          >
            <span aria-hidden="true" class="i-lucide-alarm-clock size-3.5" />
            <span>{{ action.label }}</span>
          </button>

          <button
            v-if="rawContactPhoneNumber"
            v-tooltip.top="'Copiar telefone'"
            type="button"
            class="inline-flex size-7 items-center justify-center rounded-full border border-[#ececf0] bg-white text-[#6f747c] transition hover:border-[#ffd0ad] hover:bg-[#fff7ef] hover:text-[#ff6a00] dark:border-[#30251f] dark:bg-[#211712]"
            @click="copyPhoneNumber"
          >
            <span aria-hidden="true" class="i-lucide-copy size-3.5" />
          </button>
        </div>
      </div>
    </div>
    <div
      class="flex flex-row items-center justify-start xl:justify-end flex-shrink-0 gap-2 w-full xl:w-auto header-actions-wrap"
    >
      <SLACardLabel
        v-if="hasSlaPolicyId"
        :chat="chat"
        show-extended-info
        :parent-width="width"
        class="hidden md:flex"
      />
      <MoreActions :conversation-id="currentChat.id" />
    </div>
  </div>
</template>
