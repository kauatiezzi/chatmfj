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
  FOLLOW_UP_ATTRIBUTE,
  FOLLOW_UP_ACTIONS,
  SALES_LABELS,
  SALES_STAGE_ACTIONS,
  getFollowUpBadge,
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
const showCustomFollowUp = ref(false);
const customFollowUpAt = ref('');
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

const followUpBadge = computed(() => getFollowUpBadge(currentChat.value));

const followUpActionItems = computed(() => [
  ...FOLLOW_UP_ACTIONS,
  {
    id: 'seven_days',
    label: '7 dias',
    hours: 168,
  },
  {
    id: 'thirty_days',
    label: '30 dias',
    hours: 720,
  },
]);

const salesStageLabels = computed(() =>
  SALES_STAGE_ACTIONS.filter(
    action => action.id !== SALES_LABELS.FOLLOW_UP
  ).map(action => action.id)
);

const activeSalesStage = computed(() =>
  SALES_STAGE_ACTIONS.find(
    action =>
      action.id !== SALES_LABELS.FOLLOW_UP &&
      savedLabels.value.includes(action.id)
  )
);

const updateConversationLabels = labels => {
  store.dispatch('conversationLabels/update', {
    conversationId: currentChat.value?.id,
    labels,
  });
};

const setSalesLabel = labelTitle => {
  const nextLabels =
    labelTitle === SALES_LABELS.FOLLOW_UP
      ? [...savedLabels.value]
      : savedLabels.value.filter(
          label => !salesStageLabels.value.includes(label)
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

const setFollowUpAt = followUpAt => {
  const nextLabels = savedLabels.value.includes(SALES_LABELS.FOLLOW_UP)
    ? savedLabels.value
    : [...savedLabels.value, SALES_LABELS.FOLLOW_UP];

  updateConversationLabels(nextLabels);
  store.dispatch('toggleStatus', {
    conversationId: currentChat.value?.id,
    status: wootConstants.STATUS_TYPE.OPEN,
    customAttributes: {
      [FOLLOW_UP_ATTRIBUTE]: followUpAt,
    },
  });
};

const scheduleFollowUp = action => {
  setFollowUpAt(getSnoozeDate(action.hours));
};

const scheduleCustomFollowUp = () => {
  if (!customFollowUpAt.value) return;

  setFollowUpAt(new Date(customFollowUpAt.value).toISOString());
  showCustomFollowUp.value = false;
};

const clearFollowUp = () => {
  updateConversationLabels(
    savedLabels.value.filter(label => label !== SALES_LABELS.FOLLOW_UP)
  );
  store.dispatch('toggleStatus', {
    conversationId: currentChat.value?.id,
    status: wootConstants.STATUS_TYPE.OPEN,
    customAttributes: {
      [FOLLOW_UP_ATTRIBUTE]: null,
    },
  });
};

const onRemoveLabel = label => {
  if (label === SALES_LABELS.FOLLOW_UP) {
    clearFollowUp();
  } else {
    removeLabelFromConversation(label);
  }
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

const customFollowUpLabel = 'Personalizar';
const saveFollowUpLabel = 'Salvar retorno';
</script>

<template>
  <div
    ref="conversationHeader"
    class="relative z-20 flex w-full min-w-0 flex-1 flex-col gap-4 border-b border-[#ececf0] bg-white px-5 py-4 dark:border-[#2b211c] dark:bg-[#17120f] xl:flex-row xl:items-start xl:justify-between"
  >
    <div
      class="flex w-full max-w-full items-start justify-start gap-3 xl:w-auto xl:flex-1"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="mt-2 ltr:mr-1 rtl:ml-1"
      />
      <Avatar
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="48"
        :status="currentContact.availability_status"
        hide-offline-status
        rounded-full
      />
      <div class="flex min-w-0 flex-1 flex-col items-start">
        <div
          class="flex max-w-full flex-row flex-wrap items-center gap-x-2 gap-y-1 p-0 m-0"
        >
          <span
            class="min-w-0 max-w-full truncate text-base font-semibold leading-tight text-[#1f1f24] dark:text-[#fffaf4]"
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
          class="mt-1 flex max-w-full flex-wrap items-center gap-2 text-xs conversation--header--actions text-n-slate-11"
        >
          <button
            type="button"
            class="inline-flex h-6 items-center rounded-full bg-[#f4f4f5] px-2 text-xs font-semibold text-[#6f747c] hover:text-[#ff6a00] dark:bg-[#211712]"
            @click="copyConversationId"
          >
            {{ `#${chat.id}` }}
          </button>
          <span
            v-if="contactPhoneNumber"
            class="inline-flex min-w-0 items-center gap-1 rounded-full bg-[#fff7ef] px-2 py-1 font-semibold text-[#9a4b00] dark:bg-[#2a1b13] dark:text-[#ffb272]"
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
          class="relative mt-3 flex max-w-full flex-wrap items-center gap-1.5"
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
            @remove="onRemoveLabel"
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
              @remove="onRemoveLabel"
            />
          </div>
        </div>

        <div class="mt-3 flex max-w-full flex-wrap items-center gap-2 text-xs">
          <button
            v-if="showSelfAssignAction"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ffd0ad] bg-[#fff7ef] px-3 font-semibold text-[#ff6a00] transition hover:bg-[#ffe7d4] dark:border-[#4a2b17] dark:bg-[#2a1b13]"
            @click="selfAssignConversation"
          >
            <span aria-hidden="true" class="i-lucide-user-check size-4" />
            <span>{{ t('CONVERSATION.ASSIGN_TO_ME') }}</span>
          </button>

          <button
            v-for="action in SALES_STAGE_ACTIONS"
            :key="action.id"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ececf0] bg-white px-3 font-semibold text-[#6f747c] transition hover:border-[#ffd0ad] hover:bg-[#fff7ef] hover:text-[#ff6a00] dark:border-[#30251f] dark:bg-[#211712]"
            :class="{
              'border-[#ffb272] bg-[#fff1e5] text-[#ff6a00] dark:bg-[#321f12]':
                activeSalesStage?.id === action.id,
            }"
            @click="setSalesLabel(action.id)"
          >
            <span aria-hidden="true" :class="action.icon" class="size-4" />
            <span>{{ action.label }}</span>
          </button>

          <span
            class="hidden h-4 w-px bg-[#ececf0] dark:bg-[#3a281f] md:inline-flex"
          />

          <button
            v-for="action in followUpActionItems"
            :key="action.id"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fff7ef] px-3 font-semibold text-[#9a4b00] transition hover:bg-[#ffe7d4] dark:bg-[#2a1b13] dark:text-[#ffb272]"
            @click="scheduleFollowUp(action)"
          >
            <span aria-hidden="true" class="i-lucide-alarm-clock size-4" />
            <span>{{ action.label }}</span>
          </button>

          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ffd0ad] bg-white px-3 font-semibold text-[#9a4b00] transition hover:bg-[#fff7ef] dark:border-[#3a281f] dark:bg-[#211712]"
            @click="showCustomFollowUp = !showCustomFollowUp"
          >
            <span aria-hidden="true" class="i-lucide-calendar-plus size-4" />
            <span>{{ customFollowUpLabel }}</span>
          </button>

          <button
            v-if="rawContactPhoneNumber"
            v-tooltip.top="'Copiar telefone'"
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-lg border border-[#ececf0] bg-white text-[#6f747c] transition hover:border-[#ffd0ad] hover:bg-[#fff7ef] hover:text-[#ff6a00] dark:border-[#30251f] dark:bg-[#211712]"
            @click="copyPhoneNumber"
          >
            <span aria-hidden="true" class="i-lucide-copy size-4" />
          </button>

          <div
            v-if="followUpBadge"
            class="inline-flex h-9 items-center gap-2 rounded-lg px-3 font-semibold"
            :class="
              followUpBadge.isDue
                ? 'bg-[#ff6a00] text-white'
                : 'bg-[#fff7ef] text-[#9a4b00] dark:bg-[#2a1b13] dark:text-[#ffb272]'
            "
          >
            <span aria-hidden="true" class="i-lucide-calendar-clock size-4" />
            <span>{{ followUpBadge.label }}</span>
            <button
              v-tooltip.top="'Remover retorno'"
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-full bg-white/30 hover:bg-white/50"
              @click="clearFollowUp"
            >
              <span aria-hidden="true" class="i-lucide-x size-3.5" />
            </button>
          </div>
        </div>

        <div
          v-if="showCustomFollowUp"
          class="mt-2 flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-[#ffd0ad] bg-[#fff7ef] p-2 dark:border-[#3a281f] dark:bg-[#211712]"
        >
          <input
            v-model="customFollowUpAt"
            type="datetime-local"
            class="h-9 rounded-md border border-[#ffd0ad] bg-white px-3 text-sm text-[#1f1f24] outline-none focus:border-[#ff6a00] dark:border-[#3a281f] dark:bg-[#17120f] dark:text-[#fffaf4]"
          />
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1 rounded-md bg-[#ff6a00] px-3 text-sm font-semibold text-white hover:bg-[#e65f00]"
            @click="scheduleCustomFollowUp"
          >
            <span aria-hidden="true" class="i-lucide-check size-4" />
            <span>{{ saveFollowUpLabel }}</span>
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
