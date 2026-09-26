import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchPrivacyNotice } from '@/api/public';
import { MarkdownText } from '@/components/markdown-text';
import { ErrorText, Loading, Screen } from '@/components/ui';

/** Aviso de privacidad vigente, público en web y en la app (T044). */
export default function PrivacyNoticePage() {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPrivacyNotice().then(
      (n) => setText(n.text),
      () => setError(true),
    );
  }, []);

  if (error) {
    return (
      <Screen>
        <ErrorText>{t('common.error')}</ErrorText>
      </Screen>
    );
  }
  if (!text) return <Loading />;
  return (
    <Screen>
      <MarkdownText source={text} />
    </Screen>
  );
}
