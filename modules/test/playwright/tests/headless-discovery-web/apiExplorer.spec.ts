/**
 * SPDX-FileCopyrightText: (c) 2000 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {expect, mergeTests} from '@playwright/test';

import {loginTest} from '../../fixtures/loginTest';

export const test = mergeTests(loginTest());
test(
	'Error mensaje is shown if the endpoint parameter is wrong',
	{tag: '@LPD-59421'},
	async ({page}) => {
		await page.goto('/o/api?endpoint=http://attacker.com/openapi.json');

		await expect(page.getByText(`Forbidden access.`)).toBeVisible({
			timeout: 3000,
		});
	}
);
