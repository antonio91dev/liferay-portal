/**
 * SPDX-FileCopyrightText: (c) 2000 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {expect, mergeTests} from '@playwright/test';

import {dataApiHelpersTest} from '../../../fixtures/dataApiHelpersTest';
import {featureFlagsTest} from '../../../fixtures/featureFlagsTest';
import {isolatedSiteTest} from '../../../fixtures/isolatedSiteTest';
import {loginTest} from '../../../fixtures/loginTest';
import {rolesPagesTest} from '../../../fixtures/rolesPagesTest';
import {usersAndOrganizationsPagesTest} from '../../../fixtures/usersAndOrganizationsPagesTest';
import {nextPage, setItemsPerPage} from '../../../utils/pagination';

export const test = mergeTests(
	dataApiHelpersTest,
	featureFlagsTest({
		'LPD-47858': {enabled: true},
		'LPS-178052': {enabled: true},
	}),
	isolatedSiteTest,
	loginTest(),
	rolesPagesTest,
	usersAndOrganizationsPagesTest
);

test(
	'Role assignments are correct when role count assigned exceeds items per page value',
	{tag: ['@LPD-56472']},
	async ({apiHelpers, editUserPage, usersAndOrganizationsPage}) => {
		const user = await apiHelpers.headlessAdminUser.postUserAccount();

		for (let i = 0; i < 22; i++) {
			const role = await apiHelpers.headlessAdminUser.postRole({
				name: 'role' + i,
				roleType: 'regular',
			});

			if (i > 0) {
				await apiHelpers.headlessAdminUser.assignUserToRole(
					role.externalReferenceCode,
					user.id
				);
			}
		}

		await usersAndOrganizationsPage.goToUsers();

		await (
			await usersAndOrganizationsPage.usersTableRowLink(
				user.alternateName
			)
		).click();
		await editUserPage.rolesLink.click();
		await editUserPage.selectRegularRolesButton.click();

		await setItemsPerPage(editUserPage.selectRegularRolesFrame, 20);

		await expect(
			editUserPage.selectRegularRolesChooseButton('role0')
		).toBeEnabled();
		await expect(
			editUserPage.selectRegularRolesChooseButton('role1').first()
		).toBeDisabled();

		await nextPage(editUserPage.selectRegularRolesFrame);

		await expect(
			editUserPage.selectRegularRolesChooseButton('role21')
		).toBeDisabled();
	}
);
