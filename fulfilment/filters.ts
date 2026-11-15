export const ORDER_FILTERS = ['to-ship', 'ready', 'on-hold', 'shipped', 'all'] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export const FILTER_LABELS: Record<OrderFilter, string> = {
	all: 'All',
	'on-hold': 'On hold',
	ready: 'Ready to dispatch',
	shipped: 'Shipped',
	'to-ship': 'To ship',
};

/** Orders one bulk dispatch may carry, to stay inside a Worker's subrequest budget. */
export const BULK_DISPATCH_LIMIT = 20;
