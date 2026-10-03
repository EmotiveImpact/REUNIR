import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, OFFLINE_MESSAGE, displayError, failureOf } from '../apps/web/src/lib/errors';
import { commandSchema } from '../packages/contracts/src/index';
import { TWO_FACTOR_REQUIRED, TWO_FACTOR_REQUIRED_MESSAGE } from '../packages/contracts/src/two-factor';

test('failures are told apart by what a person can do about them', () => {
    assert.equal(failureOf(new ApiError(OFFLINE_MESSAGE, 0, 'OFFLINE')), 'offline');
    assert.equal(failureOf(new TypeError('Failed to fetch')), 'offline');
    assert.equal(failureOf(new ApiError('Please sign in.', 401, 'UNAUTHENTICATED')), 'session');
    assert.equal(failureOf(new ApiError(TWO_FACTOR_REQUIRED_MESSAGE, 403, TWO_FACTOR_REQUIRED)), 'two-factor');
    assert.equal(failureOf(new ApiError('Not authorised.', 403, 'FORBIDDEN')), 'forbidden');
    assert.equal(failureOf(new ApiError('Endpoint not found.', 404, 'NOT_FOUND')), 'not-found');
    assert.equal(failureOf(new Error('Failed to fetch dynamically imported module: /assets/messages.js')), 'outdated');
    assert.equal(failureOf(new Error('Cannot read properties of undefined')), 'unknown');
    assert.equal(failureOf(new ApiError('This action could not be completed.', 500, 'INTERNAL')), 'unknown');
});

test('error messages stay plain: a blank field is named, an unreachable server says nothing was saved', () => {
    const blank = commandSchema.safeParse({ type: 'profile.update', name: '   ', headline: '', bio: '', skills: [] });
    assert.equal(blank.success, false);
    assert.equal(displayError(blank.error), 'Nothing was saved. Fill in the name and try again.');
    assert.equal(displayError(new TypeError('Failed to fetch')), OFFLINE_MESSAGE);
    assert.equal(displayError(new ApiError(TWO_FACTOR_REQUIRED_MESSAGE, 403, TWO_FACTOR_REQUIRED)), TWO_FACTOR_REQUIRED_MESSAGE);
});
