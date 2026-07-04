export interface Category {
  id: string;
  name: string;
  balance?: number;
}

export interface Split {
  id: string;
  amount: number | string;
  categoryId: string | null;
  memo: string | null;
  createdAt: string;
}

export interface ExternalOrderItem {
  id: string;
  externalOrderId: string;
  title: string;
  rawTitle: string | null;
  price: number | string;
  quantity: number;
  categoryHint: string | null;
}

export interface ExternalOrder {
  id: string;
  orderId: string;
  source: string;
  date: Date | string;
  totalAmount: number | string;
  items?: ExternalOrderItem[];
}

export interface AccountShort {
  id: string;
  name: string;
  displayName: string | null;
}

export type Transaction = {
  id: string;
  date: Date;
  payee: string;
  rawPayee: string | null;
  amount: number | string;
  splits: Split[];
  accountId: string;
  account?: AccountShort | null;
  externalOrderId: string | null;
  externalOrder?: ExternalOrder | null;
  isHidden: boolean;
  memo: string | null;
}


export interface Settings {
  id: string;
  savingsTarget: number;
  simpleFinToken: string | null;
  lastSync: Date | null;
}
