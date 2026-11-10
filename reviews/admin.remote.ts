import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { z } from 'zod';

import { shopping } from '../config';
import { REVIEW_STATUSES } from '../db/schema';
import { ModerateReviewSchema } from './schema';
import { ReviewService } from './service.server';

const reviewService = () => new ReviewService(shopping().db());

export const getReviews = Remote.Query(z.enum(REVIEW_STATUSES), (status) => {
	const service = reviewService();
	return service.list(status);
});

export const getPendingReviewCount = Remote.Query(() => {
	const service = reviewService();
	return service.countPending();
});

export const moderateReviewForm = Remote.Form(ModerateReviewSchema, async ({ id, status }) => {
	const service = reviewService();
	await service.moderate(id, status);
	await Promise.all(
		REVIEW_STATUSES.map((s) => getReviews(s).refresh()).concat(getPendingReviewCount().refresh())
	);
	return FormResult.ok(status === 'approved' ? 'Review approved.' : 'Review rejected.');
});
