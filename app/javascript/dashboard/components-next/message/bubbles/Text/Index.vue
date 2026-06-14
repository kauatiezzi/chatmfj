<script setup>
import { computed, ref } from 'vue';
import BaseBubble from 'next/message/bubbles/Base.vue';
import FormattedContent from './FormattedContent.vue';
import AttachmentChips from 'next/message/chips/AttachmentChips.vue';
import TranslationToggle from 'dashboard/components-next/message/TranslationToggle.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import { MESSAGE_TYPES } from '../../constants';
import { useMessageContext } from '../../provider.js';
import { useTranslations } from 'dashboard/composables/useTranslations';

const { content, attachments, contentAttributes, messageType } =
  useMessageContext();

const { hasTranslations, translationContent } =
  useTranslations(contentAttributes);

const renderOriginal = ref(false);

const renderContent = computed(() => {
  if (renderOriginal.value) {
    return content.value;
  }

  if (hasTranslations.value) {
    return translationContent.value;
  }

  return content.value;
});

const isTemplate = computed(() => {
  return messageType.value === MESSAGE_TYPES.TEMPLATE;
});

const groupSender = computed(() => {
  const match = renderContent.value?.match(
    /^(\+?\d[\d\s().-]{7,})\s*-\s*([^:\n]{1,80}):\s*\n*([\s\S]*)$/
  );

  if (!match) return null;

  const [, phone, name, message] = match;
  return {
    phone: phone.trim(),
    name: name.trim(),
    initials: name.trim().charAt(0).toUpperCase(),
    message: message.trim(),
  };
});

const visibleContent = computed(() => {
  return groupSender.value?.message || renderContent.value;
});

const isEmpty = computed(() => {
  return !content.value && !attachments.value?.length;
});

const handleSeeOriginal = () => {
  renderOriginal.value = !renderOriginal.value;
};
</script>

<template>
  <BaseBubble class="px-4 py-3" data-bubble-name="text">
    <div class="gap-3 flex flex-col">
      <span v-if="isEmpty" class="text-n-slate-11">
        {{ $t('CONVERSATION.NO_CONTENT') }}
      </span>
      <div
        v-if="groupSender"
        class="-mx-1 -mt-1 flex items-center gap-2 rounded-md bg-[#fff7ef] px-2 py-1.5 text-xs text-[#7a4a24]"
      >
        <div
          class="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-[0.625rem] font-semibold text-white"
        >
          {{ groupSender.initials }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1 font-semibold">
            <Icon icon="i-lucide-users" class="size-3 flex-shrink-0" />
            <span class="truncate">{{ groupSender.name }}</span>
          </div>
          <div class="truncate text-[0.6875rem] text-[#9a6a43]">
            {{ groupSender.phone }}
          </div>
        </div>
      </div>
      <FormattedContent v-if="visibleContent" :content="visibleContent" />
      <TranslationToggle
        v-if="hasTranslations"
        class="-mt-3"
        :showing-original="renderOriginal"
        @toggle="handleSeeOriginal"
      />
      <AttachmentChips :attachments="attachments" class="gap-2" />
      <template v-if="isTemplate">
        <div
          v-if="contentAttributes.submittedEmail"
          class="px-2 py-1 rounded-lg bg-n-alpha-3"
        >
          {{ contentAttributes.submittedEmail }}
        </div>
      </template>
    </div>
  </BaseBubble>
</template>

<style>
p:last-child {
  margin-bottom: 0;
}
</style>
