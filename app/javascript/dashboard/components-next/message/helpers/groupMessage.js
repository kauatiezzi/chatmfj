export const parseGroupMessageSender = content => {
  const match = String(content || '').match(
    /^\s*(\+?\d[\d\s().-]{7,})\s*-\s*(.+?)\s*[:：]\s*([\s\S]*)$/u
  );

  if (!match) return null;

  const [, phone, name, message] = match;
  const trimmedName = name.trim();

  return {
    phone: phone.trim(),
    name: trimmedName,
    initials: trimmedName.charAt(0).toUpperCase(),
    message: message.trim(),
  };
};
