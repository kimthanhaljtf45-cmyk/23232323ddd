import { Redirect } from 'expo-router';

/**
 * Default redirect to subscriptions tab
 */
export default function FinanceIndex() {
  return <Redirect href="/admin/finance/subscriptions" />;
}
