import { configureShopping } from './config';

// A made-up shop, so the templates and rules can be tested without any real site's details.
configureShopping({
	brand: {
		accent: '#336699',
		accentDark: '#224466',
		accentSoft: '#cce0f5',
		address: '1 Test Street, Testville, TE1 1ST',
		name: 'Test Shop',
		supportEmail: 'support@test.example',
	},
	db: () => {
		throw new Error('no database in unit tests');
	},
	mail: {
		backInStock: async () => {},
		newOrderAlert: async () => {},
		orderConfirmed: async () => {},
		orderDispatched: async () => {},
	},
	orderNumberPrefix: 'TS',
	shipping: {
		defaultCountry: 'GB',
		freeUkFromPence: 7000,
		insuranceFromPence: 5500,
		insuranceUpliftPence: 300,
		internationalMaxOrderPence: 25000,
	},
	siteUrl: 'https://test.example',
});
