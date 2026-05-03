import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: {
    'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
  }
}).then(async res => {
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch budget data');
  }
  return res.json();
});

export function useBudget(year?: number) {
  const url = year ? `/api/v1/budget/tally?year=${year}` : '/api/v1/budget/tally';
  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    tally: data,
    isLoading,
    isError: error,
    refresh: mutate
  };
}
