/**
 * SPDX-FileCopyrightText: (c) 2025 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

package com.liferay.object.test.util;

import com.liferay.object.model.ObjectDefinition;
import com.liferay.object.model.ObjectEntry;
import com.liferay.object.service.ObjectEntryLocalServiceUtil;
import com.liferay.portal.kernel.test.util.ServiceContextTestUtil;
import com.liferay.portal.kernel.test.util.TestPropsValues;

import java.util.Collections;

/**
 * @author Carolina Barbosa
 */
public class ObjectEntryTestUtil {

	public static ObjectEntry addObjectEntry(ObjectDefinition objectDefinition)
		throws Exception {

		return ObjectEntryLocalServiceUtil.addObjectEntry(
			TestPropsValues.getUserId(), 0,
			objectDefinition.getObjectDefinitionId(), Collections.emptyMap(),
			ServiceContextTestUtil.getServiceContext());
	}

}