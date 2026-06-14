<script setup>
import { ref, computed, provide } from 'vue';
import { Virtualizer } from 'virtua/vue';
import { useBreakpoints } from '@vueuse/core';
import { useChatListKeyboardEvents } from 'dashboard/composables/chatlist/useChatListKeyboardEvents';
import ConversationItem from './ConversationItem.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import IntersectionObserver from 'dashboard/components/IntersectionObserver.vue';
import { useMapGetter } from 'dashboard/composables/store';

import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  conversationList: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  showEndOfListMessage: { type: Boolean, default: false },
  label: { type: String, default: '' },
  teamId: { type: [String, Number], default: 0 },
  foldersId: { type: [String, Number], default: 0 },
  conversationType: { type: String, default: '' },
  showAssignee: { type: Boolean, default: false },
  isOnExpandedLayout: { type: Boolean, default: false },
});

const emit = defineEmits(['loadMore']);

const UNLABELED_SECTION = '__unlabeled__';

const conversationListRef = ref(null);
const virtualListRef = ref(null);
const isContextMenuOpen = ref(false);
const collapsedSections = ref({});

provide('contextMenuElementTarget', virtualListRef);

const breakpoints = useBreakpoints({
  lg: wootConstants.LARGE_SCREEN_BREAKPOINT,
});
const isLgScreen = breakpoints.greaterOrEqual('lg');
const showExpandedCards = computed(
  () => props.isOnExpandedLayout && isLgScreen.value
);
const accountLabels = useMapGetter('labels/getLabels');
const labelTitles = computed(() =>
  accountLabels.value.map(({ title }) => title)
);

const getPrimaryLabel = conversation =>
  conversation.labels?.find(label => labelTitles.value.includes(label)) ||
  conversation.labels?.[0] ||
  UNLABELED_SECTION;

const groupedConversationSections = computed(() => {
  const groupedConversations = props.conversationList.reduce(
    (conversationGroups, conversation) => {
      const sectionKey = getPrimaryLabel(conversation);
      const sectionConversations = conversationGroups.get(sectionKey) || [];
      sectionConversations.push(conversation);
      conversationGroups.set(sectionKey, sectionConversations);
      return conversationGroups;
    },
    new Map()
  );

  const orderedLabelKeys = labelTitles.value.filter(title =>
    groupedConversations.has(title)
  );
  const remainingLabelKeys = [...groupedConversations.keys()]
    .filter(key => key !== UNLABELED_SECTION && !orderedLabelKeys.includes(key))
    .sort((currentKey, nextKey) => currentKey.localeCompare(nextKey));
  const sectionKeys = groupedConversations.has(UNLABELED_SECTION)
    ? [UNLABELED_SECTION, ...orderedLabelKeys, ...remainingLabelKeys]
    : [...orderedLabelKeys, ...remainingLabelKeys];

  return sectionKeys.map(key => ({
    key,
    title: key === UNLABELED_SECTION ? '' : key,
    conversations: groupedConversations.get(key),
  }));
});

useChatListKeyboardEvents(conversationListRef);

const intersectionObserverOptions = computed(() => ({
  root: conversationListRef.value,
  rootMargin: '100px 0px 100px 0px',
}));

const onContextMenuToggle = state => {
  isContextMenuOpen.value = state;
};

const loadMoreConversations = () => {
  emit('loadMore');
};

const isSectionCollapsed = key => collapsedSections.value[key];

const toggleSection = key => {
  collapsedSections.value = {
    ...collapsedSections.value,
    [key]: !collapsedSections.value[key],
  };
};

provide('toggleContextMenu', onContextMenuToggle);

defineExpose({ conversationListRef });
</script>

<template>
  <div
    ref="conversationListRef"
    class="flex-1 min-h-0 overflow-y-auto conversations-list"
    :class="{ '!overflow-hidden': isContextMenuOpen }"
  >
    <div v-if="!isOnExpandedLayout" ref="virtualListRef" class="space-y-3 p-3">
      <section
        v-for="section in groupedConversationSections"
        :key="section.key"
        class="overflow-hidden rounded-xl border border-[#ececf0] bg-white shadow-sm dark:border-[#2b211c] dark:bg-[#17120f]"
      >
        <button
          type="button"
          class="flex h-12 w-full items-center gap-2 px-3 text-left hover:bg-[#fff4ea] dark:hover:bg-[#241914]"
          @click="toggleSection(section.key)"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-[11px] font-semibold leading-none text-white"
          >
            {{ section.conversations.length }}
          </span>
          <span
            class="min-w-0 flex-1 truncate text-sm font-semibold text-[#1f1f24] dark:text-[#fffaf4]"
          >
            {{ section.title || $t('CHAT_LIST.LABEL_SECTIONS.PENDING') }}
          </span>
          <span
            aria-hidden="true"
            class="i-lucide-chevron-down size-4 shrink-0 text-[#7a7f89] transition-transform"
            :class="{ '-rotate-90': isSectionCollapsed(section.key) }"
          />
        </button>
        <div
          v-show="!isSectionCollapsed(section.key)"
          class="divide-y divide-[#f1f1f4] dark:divide-[#2b211c]"
        >
          <ConversationItem
            v-for="item in section.conversations"
            :key="item.id"
            :source="item"
            :label="label"
            :team-id="teamId"
            :folders-id="foldersId"
            :conversation-type="conversationType"
            :show-assignee="showAssignee"
            :show-expanded="false"
          />
        </div>
      </section>
    </div>
    <Virtualizer
      v-else
      ref="virtualListRef"
      v-slot="{ item }"
      :data="conversationList"
      class="[&>div:has(+_div_.active)>*]:!border-n-surface-1 [&>div:has(+_div_.selected)>*]:!border-n-surface-1"
    >
      <ConversationItem
        :source="item"
        :label="label"
        :team-id="teamId"
        :folders-id="foldersId"
        :conversation-type="conversationType"
        :show-assignee="showAssignee"
        :show-expanded="showExpandedCards"
      />
    </Virtualizer>
    <div v-if="isLoading" class="flex justify-center my-4">
      <Spinner class="text-n-brand" />
    </div>
    <p v-else-if="showEndOfListMessage" class="p-4 text-center text-n-slate-11">
      {{ $t('CHAT_LIST.EOF') }}
    </p>
    <IntersectionObserver
      v-else
      :options="intersectionObserverOptions"
      @observed="loadMoreConversations"
    />
  </div>
</template>
