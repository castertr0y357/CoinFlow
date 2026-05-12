import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: {
    'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
  }
}).then(res => res.json());

export function useTransactions(inboxOnly: boolean = true, includeHidden: boolean = false, hiddenOnly: boolean = false) {
  const url = `/api/v1/transactions?inboxOnly=${inboxOnly}&includeHidden=${includeHidden}&hiddenOnly=${hiddenOnly}`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    transactions: data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}
