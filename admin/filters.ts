export const ORDER_FILTERS = ['to-ship', 'shipped', 'all'] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export const FILTER_LABELS: Record<OrderFilter, string> = {
	all: 'All',
	shipped: 'Shipped',
	'to-ship': 'To ship',
};
