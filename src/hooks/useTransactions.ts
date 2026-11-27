import useSWR, { mutate as globalMutate } from 'swr';

const fetcher = (url: string) => fetch(url, {
  cache: 'no-store',
  headers: {
    'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
  }
}).then(res => res.json());

export function useTransactions(
  inboxOnly: boolean = true,
  includeHidden: boolean = false,
  hiddenOnly: boolean = false,
  search: string = ""
) {
  const params = new URLSearchParams({
    inboxOnly: String(inboxOnly),
    includeHidden: String(includeHidden),
    hiddenOnly: String(hiddenOnly),
  });
  if (search.trim()) {
    params.set("q", search.trim());
  }
  const url = `/api/v1/transactions?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const refresh = () => {
    mutate();
    globalMutate('/api/v1/budget/tally');
  };

  return {
    transactions: data,
    isLoading,
    isError: error,
    refresh
  };
}
