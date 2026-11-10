import { Remote } from '@zeyolabs/kit/server/remote-functions';
import { FormResult } from '@zeyolabs/kit/utils/form';
import { z } from 'zod';

import { shopping } from '../config';
import { REVIEW_STATUSES } from '../db/schema';
import { ModerateReviewSchema } from '../reviews.schema';
import { ReviewService } from '../server/reviews';

const reviewService = () => new ReviewService(shopping().db());

export const getReviews = Remote.Query(z.enum(REVIEW_STATUSES), (status) =>
	reviewService().list(status)
);

export const getPendingReviewCount = Remote.Query(() => reviewService().countPending());

export const moderateReviewForm = Remote.Form(ModerateReviewSchema, async ({ id, status }) => {
	await reviewService().moderate(id, status);
	await Promise.all(
		REVIEW_STATUSES.map((s) => getReviews(s).refresh()).concat(getPendingReviewCount().refresh())
	);
	return FormResult.ok(status === 'approved' ? 'Review approved.' : 'Review rejected.');
});
