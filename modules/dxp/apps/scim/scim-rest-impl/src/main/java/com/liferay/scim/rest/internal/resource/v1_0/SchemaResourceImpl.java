/**
 * SPDX-FileCopyrightText: (c) 2025 Liferay, Inc. https://liferay.com
 * SPDX-License-Identifier: LGPL-2.1-or-later OR LicenseRef-Liferay-DXP-EULA-2.0.0-2023-06
 */

package com.liferay.scim.rest.internal.resource.v1_0;

import com.liferay.scim.rest.resource.v1_0.SchemaResource;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.ServiceScope;

/**
 * @author Olivér Kecskeméty
 */
@Component(
	properties = "OSGI-INF/liferay/rest/v1_0/schema.properties",
	scope = ServiceScope.PROTOTYPE, service = SchemaResource.class
)
public class SchemaResourceImpl extends BaseSchemaResourceImpl {

	@Override
	public Object getV2Schemas() throws Exception {
		return _buildResponse(
			_schemaResourceManager.get(
				(String)null, _userManager,
				(String)contextHttpServletRequest.getAttribute(
					WebKeys.CURRENT_COMPLETE_URL),
				null));
	}

	@Activate
	protected void activate() {
		_userManager = new UserManagerImpl(
			_classNameLocalService, _companyLocalService, _configurationAdmin,
			_expandoColumnLocalService, _expandoTableLocalService,
			_expandoValueLocalService, _searcher, _searchRequestBuilderFactory,
			_userGroupLocalService, _userGroupService, _userLocalService,
			_userService);
	}

	private Response _buildResponse(SCIMResponse scimResponse) {
		Response.ResponseBuilder responseBuilder = Response.status(
			scimResponse.getResponseStatus());

		if (scimResponse.getResponseMessage() != null) {
			responseBuilder.entity(scimResponse.getResponseMessage());
		}

		Map<String, String> map = scimResponse.getHeaderParamMap();

		if (MapUtil.isNotEmpty(map)) {
			for (Map.Entry<String, String> entry : map.entrySet()) {
				responseBuilder.header(entry.getKey(), entry.getValue());
			}
		}

		return responseBuilder.build();
	}

	private static final SchemaResourceManager _schemaResourceManager =
		new SchemaResourceManagerImpl();

	@Reference
	private ClassNameLocalService _classNameLocalService;

	@Reference
	private CompanyLocalService _companyLocalService;

	@Reference
	private ConfigurationAdmin _configurationAdmin;

	@Reference
	private ExpandoColumnLocalService _expandoColumnLocalService;

	@Reference
	private ExpandoTableLocalService _expandoTableLocalService;

	@Reference
	private ExpandoValueLocalService _expandoValueLocalService;

	@Reference
	private Searcher _searcher;

	@Reference
	private SearchRequestBuilderFactory _searchRequestBuilderFactory;

	@Reference
	private UserGroupLocalService _userGroupLocalService;

	@Reference
	private UserGroupService _userGroupService;

	@Reference
	private UserLocalService _userLocalService;

	private UserManager _userManager;

	@Reference
	private UserService _userService;

}