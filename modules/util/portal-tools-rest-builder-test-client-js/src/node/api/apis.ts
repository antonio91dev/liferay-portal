/**
 * SPDX-FileCopyrightText: (c) 2025 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

import * as http from 'http';

	import {TestEntityAddressApi} from './testEntityAddressApi';
	import {TestEntityApi} from './testEntityApi';

	export * from './testEntityAddressApi';
	export * from './testEntityApi';

/**
 * @author Alejandro Tardín
 * @generated
 */

export class HttpError extends Error {
	constructor(
		public response: http.IncomingMessage,
		public body: any,
		public statusCode?: number
	) {
		super('HTTP request failed');
		this.name = 'HttpError';
	}
}

export const APIS = [
	TestEntityAddressApi,
	TestEntityApi,
];