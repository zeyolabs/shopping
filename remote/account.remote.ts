import { getRequestEvent } from '$app/server';
import { AuthHandle } from '@zeyolabs/kit/auth/sessions/handle';
import { Remote } from '@zeyolabs/kit/server/remote-functions';

import { shopping } from '../config';
import { CustomerService } from '../server/customers';

/**
 * The signed-in customer's orders (by the email they signed in with). Needs the app's auth handle
 * (kit `AuthHandle`) in front; signed out it is a 401.
 */
export const getMyOrders = Remote.Query(async () => {
	const user = AuthHandle.requireUser(getRequestEvent());
	return {
		email: user.email,
		orders: await new CustomerService(shopping().db()).orders(user.email),
	};
});
