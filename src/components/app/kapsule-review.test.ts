import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { kapsuleRetention, scheduleKapsule } from './kapsule-review';
test('Again schedules the one-minute learning step', () => assert.deepEqual(scheduleKapsule('Again', undefined, 1000), { box: 1, due: 61000, status: 'learning' }));
test('Hard schedules six minutes', () => assert.equal(scheduleKapsule('Hard', undefined, 1000).due, 361000));
test('Good starts at one day', () => assert.equal(scheduleKapsule('Good', undefined, 1000).due, 86401000));
test('Easy starts at four days', () => assert.equal(scheduleKapsule('Easy', undefined, 1000).due, 345601000));
test('Leitner boxes grow and remain capped', () => assert.deepEqual(scheduleKapsule('Good', { box: 5, due: 0, status: 'review' }, 0), { box: 5, due: 1382400000, status: 'review' }));
test('Session retention counts successful recall only', () => assert.equal(kapsuleRetention(['Again', 'Hard', 'Good', 'Easy']), 50));