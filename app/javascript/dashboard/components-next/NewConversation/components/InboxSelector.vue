<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { vOnClickOutside } from '@vueuse/components';
import { generateLabelForContactableInboxesList } from 'dashboard/components-next/NewConversation/helpers/composeConversationHelper.js';

import Button from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

const props = defineProps({
  targetInbox: {
    type: Object,
    default: null,
  },
  selectedContact: {
    type: Object,
    default: null,
  },
  showInboxesDropdown: {
    type: Boolean,
    required: true,
  },
  contactableInboxesList: {
    type: Array,
    default: () => [],
  },
  hasErrors: {
    type: Boolean,
    default: false,
  },
  isFetchingInboxes: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'updateInbox',
  'toggleDropdown',
  'handleInboxAction',
]);

const { t } = useI18n();

const targetInboxLabel = computed(() => {
  return generateLabelForContactableInboxesList(props.targetInbox);
});
</script>

<template>
  <div
    class="flex w-full flex-1 items-center gap-3 overflow-y-visible px-4 py-3"
  >
    <label class="w-9 shrink-0 text-sm font-semibold text-[#7a4a24]">
      {{ t('COMPOSE_NEW_CONVERSATION.FORM.INBOX_SELECTOR.LABEL') }}
    </label>
    <div
      v-if="targetInbox"
      class="flex h-10 min-w-0 flex-1 items-center gap-2 truncate rounded-lg border border-[#ffd9bf] bg-[#fff7ef] ltr:pl-3 ltr:pr-1 rtl:pl-1 rtl:pr-3"
    >
      <span
        class="i-lucide-message-circle flex size-4 shrink-0 text-[#ff6a00]"
      />
      <span class="truncate text-sm font-medium text-[#1f1f24]">
        {{ targetInboxLabel }}
      </span>
      <Button
        variant="ghost"
        icon="i-lucide-x"
        color="slate"
        size="xs"
        class="flex-shrink-0"
        @click="emit('updateInbox', null)"
      />
    </div>
    <div
      v-else
      v-on-click-outside="() => emit('toggleDropdown', false)"
      class="relative flex h-10 min-w-0 flex-1 items-center"
    >
      <Spinner v-if="isFetchingInboxes" :size="16" />
      <Button
        v-else
        :label="t('COMPOSE_NEW_CONVERSATION.FORM.INBOX_SELECTOR.BUTTON')"
        variant="link"
        size="sm"
        :color="hasErrors ? 'ruby' : 'slate'"
        :disabled="!selectedContact"
        class="h-10 w-full justify-start rounded-lg border border-[#ffd9bf] bg-white px-3 text-left hover:!no-underline dark:bg-[#211712]"
        @click="emit('toggleDropdown', !showInboxesDropdown)"
      />
      <DropdownMenu
        v-if="contactableInboxesList?.length > 0 && showInboxesDropdown"
        :menu-items="contactableInboxesList"
        class="top-11 z-[100] max-h-56 w-full max-w-sm ltr:left-0 rtl:right-0 dark:!outline-n-slate-5"
        @action="emit('handleInboxAction', $event)"
      />
    </div>
  </div>
</template>
