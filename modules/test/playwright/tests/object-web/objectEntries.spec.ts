/**
 * SPDX-FileCopyrightText: (c) 2024 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import {
	ObjectDefinitionApi,
	ObjectField,
	ObjectRelationship,
	ObjectRelationshipApi,
	ObjectValidationRuleApi,
} from '@liferay/object-admin-rest-client-js';
import {expect, mergeTests} from '@playwright/test';

import {accountSettingsPagesTest} from '../../fixtures/accountSettingsPagesTest';
import {applicationsMenuPageTest} from '../../fixtures/applicationsMenuPageTest';
import {collectionsPagesTest} from '../../fixtures/collectionsPagesTest';
import {dataApiHelpersTest} from '../../fixtures/dataApiHelpersTest';
import {editObjectDefinitionPagesTest} from '../../fixtures/editObjectDefinitionPagesTest';
import {featureFlagsTest} from '../../fixtures/featureFlagsTest';
import {isolatedSiteTest} from '../../fixtures/isolatedSiteTest';
import {loginTest} from '../../fixtures/loginTest';
import {objectPagesTest} from '../../fixtures/objectPagesTest';
import {pageEditorPagesTest} from '../../fixtures/pageEditorPagesTest';
import {workflowPagesTest} from '../../fixtures/workflowPagesTest';
import {getRandomInt} from '../../utils/getRandomInt';
import getRandomString from '../../utils/getRandomString';
import {journalPagesTest} from '../journal-web/fixtures/journalPagesTest';
import getPageDefinition from '../layout-content-page-editor-web/utils/getPageDefinition';
import getWidgetDefinition from '../layout-content-page-editor-web/utils/getWidgetDefinition';
import {mockedObjectFields} from './dependencies/objectMockedFields';
import {getFDSDateFormat, getPageEditorDateFormat} from './utils/dateFormat';
import evaluateKeepCheckingAfterFound from './utils/keepCheckingAfterFound';
import {mockObjectFields} from './utils/mockObjectFields';
import { createFile, deleteFile } from './utils/fileHelpers';
import { waitForAlert } from '../../utils/waitForAlert';

export const test = mergeTests(
	accountSettingsPagesTest,
	applicationsMenuPageTest,
	collectionsPagesTest,
	dataApiHelpersTest,
	isolatedSiteTest,
	editObjectDefinitionPagesTest,
	featureFlagsTest({
		'LPD-32050': {enabled: true},
		'LPS-178052': {enabled: true},
	}),
	journalPagesTest,
	loginTest(),
	objectPagesTest,
	pageEditorPagesTest,
	workflowPagesTest
);

let siteLanguage = 'en';

test.afterEach(async ({page}) => {
	if (siteLanguage !== 'en') {
		await page.goto('en');

		siteLanguage = 'en';
	}
});

test.describe('Manage object entries through Object Definition widget', () => {
	test('verify that previous validation alerts are removed from the page when editing the entry', async ({
		apiHelpers,
		page,
		pageEditorPage,
		site,
		viewObjectEntriesPage,
	}) => {
		const objectDefinition =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				className: 'com.liferay.object.model.ObjectDefinition#1234',
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
				titleObjectFieldName: 'textField',
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		const objectValidationRuleApiClient = await apiHelpers.buildRestClient(
			ObjectValidationRuleApi
		);

		await objectValidationRuleApiClient.postObjectDefinitionByExternalReferenceCodeObjectValidationRule(
			objectDefinition.externalReferenceCode,
			{
				active: true,
				engine: 'ddm',
				errorLabel: {
					en_US: 'The field is empty',
				},
				name: {
					en_US: 'Validation 1',
				},
				objectValidationRuleSettings: [],
				script: 'not(isEmpty(textField))',
				system: false,
			}
		);
		await objectValidationRuleApiClient.postObjectDefinitionByExternalReferenceCodeObjectValidationRule(
			objectDefinition.externalReferenceCode,
			{
				active: true,
				engine: 'ddm',
				errorLabel: {
					en_US: 'The URL is invalid',
				},
				name: {
					en_US: 'Validation 2',
				},
				objectValidationRuleSettings: [],
				script: 'isEmpty(textField) OR isURL(textField)',
				system: false,
			}
		);

		const objectDefinitionWidgetDefinition = getWidgetDefinition({
			id: getRandomString(),
			widgetName:
				'com_liferay_object_web_internal_object_definitions_portlet_ObjectDefinitionsPortlet_1234',
		});

		const layout = await apiHelpers.headlessDelivery.createSitePage({
			pageDefinition: getPageDefinition([
				objectDefinitionWidgetDefinition,
			]),
			siteId: site.id,
			title: getRandomString(),
		});

		await pageEditorPage.goto(layout, site.friendlyUrlPath);

		await pageEditorPage.publishPage();

		await page.goto(`/web${site.friendlyUrlPath}${layout.friendlyUrlPath}`);

		await viewObjectEntriesPage.clickAddObjectEntry();

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(page.getByText('The field is empty')).toBeVisible();

		const objectFieldValue = getRandomString();

		await page.getByLabel('textField').fill(objectFieldValue);

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(page.getByText('The field is empty')).not.toBeVisible();
		await expect(page.getByText('The URL is invalid')).toBeVisible();
	});
});

test.describe('Manage object entries through Page Templates', () => {
	test('can view all entries related to an object in the relationship field', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const objectFields: ObjectField[] = [
			{
				DBType: "Boolean",
				businessType: "Boolean",
				externalReferenceCode: 'booleanField',
				indexed: true,
				indexedAsKeyword: false,
				indexedLanguageId: '',
				label: {en_US: 'booleanField'},
				listTypeDefinitionId: 0,
				localized: true,
				name: 'booleanField',
				required: false,
				system: false,
				type: "Boolean",
			},
			{
				DBType: "String",
				businessType: "Text",
				externalReferenceCode: 'textField',
				indexed: true,
				indexedAsKeyword: false,
				indexedLanguageId: '',
				label: {en_US: 'textField'},
				listTypeDefinitionId: 0,
				localized: true,
				name: 'textField',
				required: false,
				system: false,
				type: "String",
			},
		];

		const objectDefinitionExternalReferenceCode =
			'ObjectDefinition' + getRandomInt();

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition1} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				enableLocalization: true,
				externalReferenceCode: objectDefinitionExternalReferenceCode,
				label: {
					en_US: objectDefinitionExternalReferenceCode,
				},
				name: objectDefinitionExternalReferenceCode,
				objectFields,
				objectFolderExternalReferenceCode: 'default',
				pluralLabel: {
					en_US: objectDefinitionExternalReferenceCode,
				},
				portlet: true,
				scope: 'company',
				status: {code: 0},
				titleObjectFieldName: 'booleanField',
			});

		apiHelpers.data.push({
			id: objectDefinition1.id,
			type: 'objectDefinition',
		});

		const objectDefinition2 =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
			});

		apiHelpers.data.push({
			id: objectDefinition2.id,
			type: 'objectDefinition',
		});

		const objectRelationshipLabel =
			'objectRelationshipLabel' + getRandomInt();
		const objectRelationshipName =
			'objectRelationshipName' + Math.floor(Math.random() * 99);

		const objectRelationshipApiClient = await apiHelpers.buildRestClient(
			ObjectRelationshipApi
		);

		await objectRelationshipApiClient.postObjectDefinitionByExternalReferenceCodeObjectRelationship(
			objectDefinition1.externalReferenceCode,
			{
				label: {
					en_US: objectRelationshipLabel,
				},
				name: objectRelationshipName,
				objectDefinitionExternalReferenceCode1:
					objectDefinition1.externalReferenceCode,
				objectDefinitionExternalReferenceCode2:
					objectDefinition2.externalReferenceCode,
				objectDefinitionId1: objectDefinition1.id,
				objectDefinitionId2: objectDefinition2.id,
				objectDefinitionName2: objectDefinition2.name,
				type: "oneToMany",
			}
		);

		const applicationName =
			'c/' + objectDefinition1.name.toLowerCase() + 's';

		const itemValues = [];

		for (let i = 0; i <= 15; i++) {
			const objectEntry = await apiHelpers.objectEntry.postObjectEntry(
				{
					booleanField_i18n: {
						en_US: false,
						pt_BR: true,
					},
					textField_i18n: {
						en_US: 'entry_en_US' + i,
						pt_BR: 'entry_pt_BR' + i,
					},
				},
				applicationName
			);

			itemValues.push({
				booleanField: objectEntry.booleanField_i18n['pt_BR'],
				textField: objectEntry.textField_i18n['pt_BR'],
			});
		}

		await viewObjectEntriesPage.goto(objectDefinition2.className, 'pt');

		siteLanguage = 'pt';

		await viewObjectEntriesPage.clickAddObjectEntry();

		await page.getByPlaceholder('Buscar', {exact: true}).click();

		itemValues.forEach((itemValue, index) => {
			expect(
				page
					.getByRole('menuitem', {
						exact: true,
						name: String(itemValue.booleanField),
					})
					.nth(index)
			).toBeVisible();
		});

		await objectDefinitionAPIClient.patchObjectDefinition(
			objectDefinition1.id,
			{
				titleObjectFieldName: 'textField',
			}
		);

		await viewObjectEntriesPage.goto(objectDefinition2.className, 'pt');

		await viewObjectEntriesPage.clickAddObjectEntry();

		await page.getByPlaceholder('Buscar', {exact: true}).click();

		itemValues.forEach((itemValue) => {
			expect(
				page.getByRole('menuitem', {
					exact: true,
					name: String(itemValue.textField),
				})
			).toBeVisible();
		});
	});

	test('verify if the object entries are displayed when selecting to preview an object entry on a page template', async ({
		apiHelpers,
		displayPageTemplatesPage,
		page,
		pageEditorPage,
	}) => {
		test.slow();
		const objectDefinitionLabel = 'ObjectDefinitionLabel' + getRandomInt();
		const objectDefinitionName = 'ObjectDefinitionName' + getRandomInt();

		const {
			listTypeDefinition,
			objectEntry,
			objectFields,
			titleObjectFieldName,
		} = await mockObjectFields({
			apiHelpers,
			objectEntryReturn: {format: 'API'},
			objectFieldBusinessTypes: [
				'autoIncrement',
				'boolean',
				'date',
				'decimal',
				'encrypted',
				'integer',
				'longInteger',
				'longText',
				'multiselectPicklist',
				'picklist',
				'precisionDecimal',
				'richText',
				'text',
			],
			titleObjectFieldName: 'text',
		});

		apiHelpers.data.push({
			id: listTypeDefinition.id,
			type: 'listTypeDefinition',
		});

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				label: {
					en_US: objectDefinitionLabel,
				},
				name: objectDefinitionName,
				objectFields,
				pluralLabel: {
					en_US: objectDefinitionLabel,
				},
				portlet: true,
				scope: 'company',
				status: {
					code: 0,
				},
				titleObjectFieldName,
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		const applicationName =
			'c/' + objectDefinition.name.toLowerCase() + 's';

		await apiHelpers.objectEntry.postObjectEntry(
			objectEntry,
			applicationName
		);

		await displayPageTemplatesPage.goto();

		const displayPageTemplateName = getRandomString();

		await displayPageTemplatesPage.createTemplate({
			contentType: objectDefinition.label['en_US'],
			name: displayPageTemplateName,
		});

		await page.getByTitle(displayPageTemplateName).click();

		overloop: for (const [_, objectField] of objectDefinition.objectFields
			.filter((objectField) => !objectField.system)
			.entries()) {
			await pageEditorPage.addFragment('Basic Components', 'Heading');

			await page.getByText('Heading Example', {exact: true}).click();

			await pageEditorPage.setMappingConfiguration({
				mapping: {
					entity: objectDefinitionLabel,
					entry: objectEntry[titleObjectFieldName],
					field: objectField.label.en_US,
				},
				source: 'content',
			});

			let matchString: string;

			switch (objectField.businessType) {
				case "AutoIncrement": {
					matchString = '1';

					break;
				}
				case 'Date': {
					const date = new Date(
						Date.parse(objectEntry[objectField.name])
					);

					matchString = getPageEditorDateFormat(date);

					// Defer date validation for CI trace view analysis (issue #LRCI-4253)

					continue overloop;
				}
				case "Picklist": {
					matchString = (
						objectEntry[objectField.name] as {key: string}
					).key;

					break;
				}
				case "MultiselectPicklist": {
					(objectEntry[objectField.name] as string[]).forEach(
						(listTypeEntry, index) => {
							index < 1
								? (matchString = `${listTypeEntry}`)
								: (matchString += `, ${listTypeEntry}`);
						}
					);

					break;
				}
				default: {
					matchString = objectEntry[objectField.name].toString();
				}
			}

			await expect(
				page.getByTitle('Edit Text').filter({hasText: matchString})
			).toBeVisible();
		}

		// Clean up

		await displayPageTemplatesPage.goto();

		await displayPageTemplatesPage.deleteTemplate(objectDefinitionLabel);
	});
});

test.describe('Manage object entries through View Object Entries', () => {
	test('can add an entry with all object fields', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const ATTACHMENT_FILE_NAME = 'astronaut.png';
		const {listTypeDefinition, objectEntry, objectFields} =
			await mockObjectFields({
				apiHelpers,
				objectEntryReturn: {format: 'UI'},
				objectFieldBusinessTypes: [
					'attachment',
					'boolean',
					'date',
					'decimal',
					'integer',
					'longInteger',
					'longText',
					'picklist',
					'precisionDecimal',
					'richText',
					'text',
				],
			});

		apiHelpers.data.push({
			id: listTypeDefinition.id,
			type: 'listTypeDefinition',
		});

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				externalReferenceCode: getRandomString(),
				label: {
					en_US: getRandomString(),
				},
				name: 'ObjectDefinitionName' + getRandomInt(),
				objectFields,
				panelCategoryKey: 'control_panel.object',
				pluralLabel: {
					en_US: 'NewObject',
				},
				portlet: true,
				scope: 'company',
				status: {
					code: 0,
				},
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className);

		await viewObjectEntriesPage.clickAddObjectEntry(
			objectDefinition.label['en_US']
		);

		for (const objectField of objectFields) {
			switch (objectField.businessType) {
				case "Attachment": {
					await viewObjectEntriesPage.selectFileFromDocumentsAndMedia(
						ATTACHMENT_FILE_NAME
					);

					break;
				}
				case "Boolean": {
					objectEntry[objectField.name]
						? await page
								.getByLabel(objectField.label['en_US'])
								.check()
						: await page
								.getByLabel(objectField.label['en_US'])
								.uncheck();

					break;
				}
				case "Picklist": {
					await viewObjectEntriesPage.selectDropdownItem(
						objectField.label['en_US'],
						objectEntry[objectField.name].key.toString()
					);

					break;
				}
				default: {
					await viewObjectEntriesPage.fillObjectEntry({
						objectFieldBusinessType: objectField.businessType,
						objectFieldLabel: objectField.label['en_US'],
						objectFieldValue:
							objectEntry[objectField.name].toString(),
					});
				}
			}
		}

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(viewObjectEntriesPage.successMessage).toBeVisible();

		await viewObjectEntriesPage.backButton.click();

		for (const {businessType, name} of objectFields) {
			let matchString: string;

			switch (businessType) {
				case "Attachment": {
					matchString = ATTACHMENT_FILE_NAME;

					break;
				}
				case "Boolean": {
					matchString = objectEntry[name] ? 'Yes' : 'No';

					break;
				}
				case 'Date': {
					const date = new Date(objectEntry[name]);

					matchString = getFDSDateFormat(date);

					break;
				}
				case "Picklist": {
					matchString = (objectEntry[name] as {key: string}).key;

					break;
				}
				case "MultiselectPicklist": {
					(objectEntry[name] as string[]).forEach(
						(listTypeEntry, index) => {
							index < 1
								? (matchString = `${listTypeEntry}`)
								: (matchString += `, ${listTypeEntry}`);
						}
					);

					break;
				}
				case "RichText": {
					matchString = objectEntry[name].substring(0, 35);

					break;
				}
				default: {
					matchString = objectEntry[name];
				}
			}

			await expect(
				page.locator('.dnd-td').getByText(matchString, {exact: true})
			).toBeVisible();
		}
	});

	test(
		'can attach files after changing the overall maximum upload request size setting',
		{tag: ['@LPD-56964']},
		async ({
			apiHelpers,
			objectFieldsPage,
			page,
			systemSettingsPage,
			viewObjectDefinitionsPage,
			viewObjectEntriesPage,
		}) => {
			try {
				await test.step('set overall maximum upload request size to 2MB in system settings', async () => {
					await systemSettingsPage.goToSystemSetting(
						'Infrastructure',
						'Upload Servlet Request'
					);

					await page
						.getByLabel('Overall Maximum Upload Request Size')
						.fill('2097152');

					await page
						.getByRole('button', {name: 'Save'})
						.or(page.getByRole('button', {name: 'Update'}))
						.click();
				});

				const objectDefinition =
					await apiHelpers.objectAdmin.postRandomObjectDefinition({
						status: {code: 0},
					});

				await test.step('create attachment object field', async () => {
					apiHelpers.data.push({
						id: objectDefinition.id,
						type: 'objectDefinition',
					});

					await viewObjectDefinitionsPage.goto();

					await objectFieldsPage.goto(
						objectDefinition.label['en_US']
					);

					await objectFieldsPage.addObjectField({
						attachmentSource: 'Upload Directly from the User',
						objectFieldBusinessType: 'Attachment',
						objectFieldLabel: 'Attachment',
					});
				});

				await test.step('Verify attachment field maximum file size validation', async () => {
					// await objectFieldsPage.openObjectField();

					await page
						.getByRole('link', { name: 'Attachment' })
						.click();

					await expect(objectFieldsPage.maximumFileSize).toHaveValue(
						'0'
					);

					await objectFieldsPage.maximumFileSize.fill('3');

					await objectFieldsPage.editFieldSaveButton.click();

					await expect(
						objectFieldsPage.getMaximumFileSizeErrorMessage({
							maximumFileSizeAllowed: '2',
						})
					).toBeVisible();
				});

				const FILE_NAME_3MB = '3MB.txt';
				const FILE_SIZE_3MB = 3;

				createFile(FILE_NAME_3MB, FILE_SIZE_3MB);

				await test.step('attempt upload with file exceeding attachment maximum allowed size', async () => {
					await viewObjectEntriesPage.goto(
						objectDefinition.className
					);

					await viewObjectEntriesPage.clickAddObjectEntry(
						objectDefinition.label['en_US']
					);

					await expect(
						page.getByText(
							'Upload a jpeg, jpg, pdf, png no larger than 2 MB.',
							{exact: true}
						)
					).toBeVisible();

					await viewObjectEntriesPage.selectFileFromUserComputer(
						__dirname,
						FILE_NAME_3MB
					);

					await expect(
						viewObjectEntriesPage.getMaximumFileSizeErrorMessage({
							maximumFileSizeAllowed: '2',
						})
					).toBeVisible();
				});

				const FILE_NAME_2MB = '2MB.png';
				const FILE_SIZE_2MB = 2;

				createFile(FILE_NAME_2MB, FILE_SIZE_2MB);

				await test.step('successfully upload file at maximum allowed size', async () => {
					await viewObjectEntriesPage.selectFileFromUserComputer(
						__dirname,
						FILE_NAME_2MB
					);

					await expect(
						viewObjectEntriesPage.getMaximumFileSizeErrorMessage({
							maximumFileSizeAllowed: '2',
						})
					).toBeHidden();

					await viewObjectEntriesPage.saveObjectEntryButton.click();

					await waitForAlert(
						page,
						'Success:Your request completed successfully.'
					);
				});

				deleteFile(FILE_NAME_3MB);
				deleteFile(FILE_NAME_2MB);
			}
			finally {
				await test.step('set overall maximum upload request size to 10MB in system settings', async () => {
					await systemSettingsPage.goToSystemSetting(
						'Infrastructure',
						'Upload Servlet Request'
					);

					await page
						.getByLabel('Overall Maximum Upload Request Size')
						.fill('104857600');

					await page.getByRole('button', {name: 'Update'}).click();
				});
			}
		}
	);

	test('can deselect the last selected option in multiple select picklist and the field is not removed from the DOM when doing so', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const {listTypeDefinition, objectEntry, objectFields} =
			await mockObjectFields({
				apiHelpers,
				objectEntryReturn: {format: 'UI'},
				objectFieldBusinessTypes: [
					'autoIncrement',
					'boolean',
					'date',
					'decimal',
					'integer',
					'longInteger',
					'longText',
					'multiselectPicklist',
					'precisionDecimal',
					'richText',
					'text',
				],
			});

		apiHelpers.data.push({
			id: listTypeDefinition.id,
			type: 'listTypeDefinition',
		});

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				externalReferenceCode: getRandomString(),
				label: {
					en_US: getRandomString(),
				},
				name: 'ObjectDefinitionName' + getRandomInt(),
				objectFields,
				panelCategoryKey: 'control_panel.object',
				pluralLabel: {
					en_US: 'NewObject',
				},
				portlet: true,
				scope: 'company',
				status: {
					code: 0,
				},
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className);

		await viewObjectEntriesPage.clickAddObjectEntry(
			objectDefinition.label['en_US']
		);

		await page.waitForLoadState('domcontentloaded');

		const placeHolderText = 'Choose Options';

		await expect(page.getByPlaceholder(placeHolderText)).toBeVisible();

		await page.getByPlaceholder(placeHolderText).click();

		const multiselectPicklistField = objectFields.find(
			({businessType}) =>
				businessType ===
				"MultiselectPicklist"
		);

		const firstOptionName = objectEntry[multiselectPicklistField.name][0];

		await page.getByTestId(`labelItem-${firstOptionName}`).click();

		await expect
			.soft(page.getByText(firstOptionName, {exact: true}))
			.toBeVisible({timeout: 50});

		const removeOptionButton = page.getByLabel('Remove ' + firstOptionName);

		await removeOptionButton.click();

		const keepsAttached = await evaluateKeepCheckingAfterFound({
			duration: 4000,
			page,
			selector: `input[placeholder="${placeHolderText}"]`,
		});

		expect.soft(keepsAttached).toBeTruthy();

		await expect.soft(removeOptionButton).not.toBeVisible();

		expect(test.info().errors).toHaveLength(0);
	});

	test('can download and delete a file from the Attachment field when adding an object entry', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const ATTACHMENT_FILE_NAME = 'astronaut.png';
		const {objectFields} = await mockObjectFields({
			apiHelpers,
			objectFieldBusinessTypes: ['attachment'],
		});

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				externalReferenceCode: getRandomString(),
				label: {
					en_US: getRandomString(),
				},
				name: 'ObjectDefinitionName' + getRandomInt(),
				objectFields,
				panelCategoryKey: 'control_panel.object',
				pluralLabel: {
					en_US: 'NewObject',
				},
				portlet: true,
				scope: 'company',
				status: {
					code: 0,
				},
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className);

		await viewObjectEntriesPage.clickAddObjectEntry(
			objectDefinition.label['en_US']
		);

		await viewObjectEntriesPage.selectFileFromDocumentsAndMedia(
			ATTACHMENT_FILE_NAME
		);

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(viewObjectEntriesPage.successMessage).toBeVisible();

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(viewObjectEntriesPage.successMessage).toBeVisible();

		const downloadPromise = page.waitForEvent('download');

		await page.getByRole('button', {name: ATTACHMENT_FILE_NAME}).hover();

		await page.locator('.lexicon-icon-download').click();

		expect((await downloadPromise).suggestedFilename()).toStrictEqual(
			`${ATTACHMENT_FILE_NAME}`
		);

		await viewObjectEntriesPage.deleteFileButton.click();

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(
			viewObjectEntriesPage.successMessage.first()
		).toBeVisible();
	});

	test('can view all entries related to an object in the relationship field using autocomplete', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const objectDefinition1 =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
				titleObjectFieldName: 'textField',
			});

		apiHelpers.data.push({
			id: objectDefinition1.id,
			type: 'objectDefinition',
		});

		const objectDefinition2 =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
			});

		apiHelpers.data.push({
			id: objectDefinition2.id,
			type: 'objectDefinition',
		});

		const objectRelationshipLabel =
			'objectRelationshipLabel' + getRandomInt();
		const objectRelationshipName =
			'objectRelationshipName' + Math.floor(Math.random() * 99);

		const objectRelationshipApiClient = await apiHelpers.buildRestClient(
			ObjectRelationshipApi
		);

		await objectRelationshipApiClient.postObjectDefinitionByExternalReferenceCodeObjectRelationship(
			objectDefinition1.externalReferenceCode,
			{
				label: {
					en_US: objectRelationshipLabel,
				},
				name: objectRelationshipName,
				objectDefinitionExternalReferenceCode1:
					objectDefinition1.externalReferenceCode,
				objectDefinitionExternalReferenceCode2:
					objectDefinition2.externalReferenceCode,
				objectDefinitionId1: objectDefinition1.id,
				objectDefinitionId2: objectDefinition2.id,
				objectDefinitionName2: objectDefinition2.name,
				type: "oneToMany",
			}
		);

		const applicationName =
			'c/' + objectDefinition1.name.toLowerCase() + 's';

		await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'test 1'},
			applicationName
		);

		await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'test 2'},
			applicationName
		);

		await viewObjectEntriesPage.goto(objectDefinition2.className);
		await viewObjectEntriesPage.clickAddObjectEntry(
			objectDefinition2.label['en_US']
		);

		await page.getByPlaceholder('Search', {exact: true}).fill('t 1');
		await expect(page.getByRole('menuitem')).toContainText('test 1');

		await page.locator('input[value="t 1"]').fill('t 2');
		await expect(page.getByRole('menuitem')).toContainText('test 2');

		await page.locator('input[value="t 2"]').fill('tes');
		await expect(page.getByRole('menu')).toContainText('test 1');
		await expect(page.getByRole('menu')).toContainText('test 2');
	});

	test('can filter entries in a M:M relationship entries page using search container', async ({
		apiHelpers,
		objectLayoutsPage,
		page,
		viewObjectEntriesPage,
	}) => {
		const objectField = 'textField';

		const objectDefinition1 =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				scope: 'company',
				status: {code: 0},
				titleObjectFieldName: objectField,
			});

		apiHelpers.data.push({
			id: objectDefinition1.id,
			type: 'objectDefinition',
		});

		const objectDefinition2 =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				scope: 'company',
				status: {code: 0},
				titleObjectFieldName: objectField,
			});

		apiHelpers.data.push({
			id: objectDefinition2.id,
			type: 'objectDefinition',
		});

		const objectRelationshipLabel =
			'objectRelationshipLabel' + getRandomInt();
		const objectRelationshipName =
			'objectRelationshipName' + getRandomInt();

		const objectRelationshipApiClient = await apiHelpers.buildRestClient(
			ObjectRelationshipApi
		);

		const objectRelationshipData: Partial<ObjectRelationship> = {
			label: {
				en_US: objectRelationshipLabel,
			},
			name: objectRelationshipName,
			objectDefinitionExternalReferenceCode1:
				objectDefinition1.externalReferenceCode,
			objectDefinitionExternalReferenceCode2:
				objectDefinition2.externalReferenceCode,
			objectDefinitionId1: objectDefinition1.id,
			objectDefinitionId2: objectDefinition2.id,
			objectDefinitionName2: objectDefinition2.name,
			type: "manyToMany",
		};

		await objectRelationshipApiClient.postObjectDefinitionByExternalReferenceCodeObjectRelationship(
			objectDefinition1.externalReferenceCode,
			objectRelationshipData
		);

		const applicationName =
			'c/' + objectDefinition1.name.toLowerCase() + 's';

		await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'test 1'},
			applicationName
		);

		await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'test 2'},
			applicationName
		);

		const objectLayoutName = getRandomString();

		const objectRelationshipTabName = getRandomString();

		await objectLayoutsPage.goto(objectDefinition2.name);

		await objectLayoutsPage.createObjectLayout(objectLayoutName);

		await page.getByRole('link', {name: objectLayoutName}).click();

		await objectLayoutsPage.markAsDefaultButton.check();

		await objectLayoutsPage.layoutTab.click();

		await objectLayoutsPage.createObjectLayoutTab(getRandomString());

		await objectLayoutsPage.createObjectLayoutBlock(getRandomString());

		await objectLayoutsPage.openObjectLayoutObjectField();

		await objectLayoutsPage.iframeLocator
			.getByRole('option', {name: objectField})
			.click();

		await objectLayoutsPage.saveAddFieldButton.click();

		await objectLayoutsPage.createObjectRelationshipTab(
			objectLayoutName,
			objectRelationshipTabName,
			objectRelationshipLabel
		);

		await viewObjectEntriesPage.goto(objectDefinition2.className);

		await viewObjectEntriesPage.clickAddObjectEntry(
			objectDefinition2.label['en_US']
		);

		await viewObjectEntriesPage.fillObjectEntry({
			objectFieldBusinessType: "Text",
			objectFieldLabel: objectField,
			objectFieldValue: 'tests',
		});

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await page.getByRole('link', {name: objectRelationshipTabName}).click();

		await viewObjectEntriesPage.addObjectEntryButton.click();

		await expect(viewObjectEntriesPage.searchButton).toBeEnabled();
		await viewObjectEntriesPage.searchBar.click();
		await viewObjectEntriesPage.searchBar.fill('t 1');
		await viewObjectEntriesPage.searchButton.click();
		await expect(viewObjectEntriesPage.searchContainer).toContainText(
			'test 1'
		);
		await expect(viewObjectEntriesPage.searchContainer).not.toContainText(
			'test 2'
		);

		await expect(viewObjectEntriesPage.searchButton).toBeEnabled();
		await viewObjectEntriesPage.searchBar.click();
		await viewObjectEntriesPage.searchBar.fill('t 2');
		await viewObjectEntriesPage.searchButton.click();
		await expect(viewObjectEntriesPage.searchContainer).toContainText(
			'test 2'
		);
		await expect(viewObjectEntriesPage.searchContainer).not.toContainText(
			'test 1'
		);

		await expect(viewObjectEntriesPage.searchButton).toBeEnabled();
		await viewObjectEntriesPage.searchBar.click();
		await viewObjectEntriesPage.searchBar.fill('tes');
		await viewObjectEntriesPage.searchButton.click();
		await expect(viewObjectEntriesPage.searchContainer).toContainText(
			'test 1'
		);
		await expect(viewObjectEntriesPage.searchContainer).toContainText(
			'test 2'
		);
	});

	test('can view success message entirely in arabic', async ({
		apiHelpers,
		viewObjectEntriesPage,
	}) => {
		const objectDefinition =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFields: [
					mockedObjectFields.attachmentFieldDocumentsAndMedia,
				],
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className, 'ar');

		await viewObjectEntriesPage.addObjectEntryButton.click();

		await viewObjectEntriesPage.selectFileFromDocumentsAndMediaArabic();

		await viewObjectEntriesPage.saveObjectEntryButtonArabic.click();

		await expect(viewObjectEntriesPage.successMessageArabic).toBeVisible();
	});

	test('verify if object entries with localized boolean field are correctly persisted', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {
		const objectDefinitionLabel = 'ObjectDefinitionLabel' + getRandomInt();
		const objectDefinitionName = 'ObjectDefinitionName' + getRandomInt();

		const {objectFields, titleObjectFieldName} = await mockObjectFields({
			apiHelpers,
			localizeAllLocalizable: true,
			objectEntryReturn: {format: 'API'},
			objectFieldBusinessTypes: ['boolean'],
			titleObjectFieldName: 'boolean',
		});

		const objectDefinitionAPIClient =
			await apiHelpers.buildRestClient(ObjectDefinitionApi);

		const {body: objectDefinition} =
			await objectDefinitionAPIClient.postObjectDefinition({
				active: true,
				enableLocalization: true,
				label: {
					en_US: objectDefinitionLabel,
				},
				name: objectDefinitionName,
				objectFields,
				pluralLabel: {
					en_US: objectDefinitionLabel,
				},
				portlet: true,
				scope: 'company',
				status: {
					code: 0,
				},
				titleObjectFieldName,
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className);

		await viewObjectEntriesPage.addObjectEntryButton.click();

		const checkBox = page.getByRole('checkbox', {
			name: objectFields[0].label['en_US'],
		});

		await checkBox.check();

		const translationsDropdownTriggerButton = page
			.getByTestId('triggerButton')
			.first();

		await translationsDropdownTriggerButton.click();

		const catalanOption = page.getByTestId('availableLocalesDropdownca_ES');

		await catalanOption.click();

		await expect(checkBox).toBeChecked();

		await checkBox.uncheck();

		await translationsDropdownTriggerButton.click();

		await expect(catalanOption.locator('.label-item-expand')).toHaveText(
			'translated',
			{ignoreCase: true}
		);

		const englishOption = page.getByTestId('availableLocalesDropdownen_US');

		await expect(englishOption.locator('.label-item-expand')).toHaveText(
			'default',
			{ignoreCase: true}
		);

		await englishOption.click();

		await expect(checkBox).toBeChecked();

		await translationsDropdownTriggerButton.click();

		await catalanOption.click();

		await expect(checkBox).not.toBeChecked();

		const responsePromise = page.waitForResponse(
			`**${objectDefinition.restContextPath}`
		);

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		const response = await responsePromise;

		await expect(
			page.getByText('Success:Your request completed successfully.')
		).toBeVisible();

		await page.getByRole('link', {name: 'Back'}).click();

		const responseBody = await response.json();

		const entryLink = page.getByRole('link', {name: responseBody.id});

		await entryLink.click();

		await expect(checkBox).toBeChecked();

		await translationsDropdownTriggerButton.click();

		await catalanOption.click();

		await expect(checkBox).not.toBeChecked();
	});

	test('Verify that temporary files are deleted from the database if the object creation is not completed', async ({
		apiHelpers,
		page,
		viewObjectEntriesPage,
	}) => {

		// Create object definition with attachment object field

		const objectDefinition =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFields: [mockedObjectFields.attachmentFieldUserComputer],
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await viewObjectEntriesPage.goto(objectDefinition.className);

		await viewObjectEntriesPage.clickAddObjectEntry(objectDefinition.name);

		// Upload first file from user computer

		await viewObjectEntriesPage.selectFileFromUserComputer(
			__dirname,
			'sampleFile.txt'
		);

		await page
			.getByRole('button', {name: 'sampleFile.txt'})
			.waitFor({state: 'visible'});

		const fileEntryId1 = await page.getAttribute(
			'input[data-field-name^="testAttachment"]',
			'value'
		);

		expect(
			await apiHelpers.headlessDelivery.getDocument(fileEntryId1)
		).toEqual(
			expect.objectContaining({
				id: Number(fileEntryId1),
			})
		);

		// Verify that the first file is removed after the second file is uploaded

		await viewObjectEntriesPage.selectFileFromUserComputer(
			__dirname,
			'astronaut.png'
		);

		await page
			.getByRole('button', {name: 'astronaut.png'})
			.waitFor({state: 'visible'});

		expect(
			await apiHelpers.headlessDelivery.getDocument(fileEntryId1)
		).toEqual({status: 'NOT_FOUND'});

		const fileEntryId2 = await page.getAttribute(
			'input[data-field-name^="testAttachment"]',
			'value'
		);

		expect(
			await apiHelpers.headlessDelivery.getDocument(fileEntryId2)
		).toEqual(
			expect.objectContaining({
				id: Number(fileEntryId2),
			})
		);

		// Verify that the delete button removes the second file

		await viewObjectEntriesPage.deleteFileButton.click();

		expect(
			await apiHelpers.headlessDelivery.getDocument(fileEntryId2)
		).toEqual({status: 'NOT_FOUND'});

		// Verify that the file is removed after page reload

		await viewObjectEntriesPage.selectFileFromUserComputer(
			__dirname,
			'sampleFile.txt'
		);

		await page
			.getByRole('button', {name: 'sampleFile.txt'})
			.waitFor({state: 'visible'});

		const fileEntryId3 = await page.getAttribute(
			'input[data-field-name^="testAttachment"]',
			'value'
		);

		await page.reload();

		expect(
			await apiHelpers.headlessDelivery.getDocument(fileEntryId3)
		).toEqual({status: 'NOT_FOUND'});

		// Verify that the file is saved successfully when clicking submit

		await viewObjectEntriesPage.selectFileFromUserComputer(
			__dirname,
			'astronaut.png'
		);

		await page
			.getByRole('button', {name: 'astronaut.png'})
			.waitFor({state: 'visible'});

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(viewObjectEntriesPage.successMessage).toBeVisible();
		await expect(
			viewObjectEntriesPage.page.getByText('astronaut.png')
		).toBeVisible();

		await viewObjectEntriesPage.selectFileFromUserComputer(
			__dirname,
			'sampleFile.txt'
		);

		await page
			.getByRole('button', {name: 'sampleFile.txt'})
			.waitFor({state: 'visible'});

		await page.reload();

		await expect(
			viewObjectEntriesPage.page.getByText('astronaut.png')
		).toBeVisible();
	});
});

test.describe('Manage object entries through Workflow', () => {
	test('can edit object entry through workflow task page', async ({
		apiHelpers,
		applicationsMenuPage,
		configurationTabPage,
		page,
		viewObjectEntriesPage,
		workflowTaskDetailsPage,
		workflowTasksPage,
	}) => {
		const objectDefinition =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
				titleObjectFieldName: 'textField',
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await applicationsMenuPage.goToProcessBuilder();

		await configurationTabPage.configurationTabLink.click();

		await configurationTabPage.assignWorkflowToAssetType(
			'Single Approver',
			objectDefinition.label['en_US']
		);

		const applicationName =
			'c/' + objectDefinition.name.toLowerCase() + 's';

		await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'entry'},
			applicationName
		);

		await workflowTasksPage.goToAssignedToMyRoles();

		await workflowTasksPage.assignToMe('entry');

		await workflowTasksPage.goto();

		await workflowTaskDetailsPage.selectAsset(
			objectDefinition.label['en_US']
		);

		await workflowTaskDetailsPage.editAssetButton.click();

		const objectFieldValue = getRandomString();

		await viewObjectEntriesPage.fillObjectEntry({
			objectFieldBusinessType: "Text",
			objectFieldLabel: objectDefinition.titleObjectFieldName,
			objectFieldValue,
		});

		await viewObjectEntriesPage.saveObjectEntryButton.click();

		await expect(viewObjectEntriesPage.successMessage).toBeVisible();

		await viewObjectEntriesPage.backButton.click();

		await expect(page.getByLabel('textField', {exact: true})).toHaveValue(
			objectFieldValue
		);
	});

	test('can view Asset Title, Asset Type and Item Subject of an entry on metrics page', async ({
		apiHelpers,
		applicationsMenuPage,
		configurationTabPage,
		metricsPage,
		page,
	}) => {
		const assetType = 'Single Approver';

		const objectDefinition =
			await apiHelpers.objectAdmin.postRandomObjectDefinition({
				objectFolderExternalReferenceCode: 'default',
				status: {code: 0},
				titleObjectFieldName: 'textField',
			});

		apiHelpers.data.push({
			id: objectDefinition.id,
			type: 'objectDefinition',
		});

		await applicationsMenuPage.goToProcessBuilder();

		await configurationTabPage.configurationTabLink.click();

		await configurationTabPage.assignWorkflowToAssetType(
			assetType,
			objectDefinition.label['en_US']
		);

		const applicationName =
			'c/' + objectDefinition.name.toLowerCase() + 's';

		const objectEntry = await apiHelpers.objectEntry.postObjectEntry(
			{textField: 'entry'},
			applicationName
		);

		await applicationsMenuPage.goToMetrics();

		await metricsPage.chooseProcess(assetType);

		await metricsPage.viewAllPendingItems();

		const itemSubject =
			objectDefinition.label['en_US'] + ': ' + objectEntry.textField;

		await expect(page.getByLabel(itemSubject)).toBeVisible();

		await page.locator('.link-text').click();

		await expect(
			page.getByText(objectDefinition.label['en_US'])
		).toBeVisible();

		await expect(page.getByText(objectEntry.textField)).toBeVisible();
	});
});
