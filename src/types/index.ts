export interface Category {
  id: string;
  name: string;
}

export interface Split {
  id: string;
  amount: any;
  categoryId: string | null;
  memo: string | null;
}

export type Transaction = {
  id: string;
  date: Date;
  payee: string;
  rawPayee: string | null;
  amount: any;
  splits: Split[];
  amazonOrderId: string | null;
  isHidden: boolean;
}

export interface Settings {
  id: string;
  savingsTarget: any;
  simpleFinToken: string | null;
  lastSync: Date | null;
}
