/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { selectInitComplete, selectSelectedLanguage } from './slices/appStateSlice';
import { selectCurrentUserRole, selectIsAdmin } from './slices/currentUserSlice';
import { useAppSelector } from './reduxHooks';
import localeData, { LocaleDataKey } from '../translations/data';
import { createIntlCache, createIntl, defineMessages } from 'react-intl';

// necessary imports from PreferencesComponent.tsx
import { defaultAdminState } from '../redux/slices/adminSlice';
import { cloneDeep, isEqual } from 'lodash';
import * as moment from 'moment';
import * as React from 'react';
//import { UnsavedWarningComponent } from '../UnsavedWarningComponent';
import { preferencesApi } from '../redux/api/preferencesApi';
import {
	MIN_DATE, MIN_DATE_MOMENT, MAX_DATE, MAX_DATE_MOMENT, MAX_ERRORS
} from '../redux/selectors/adminSelectors';
import { PreferenceRequestItem } from '../types/items';


export const useWaitForInit = () => {
	const isAdmin = useAppSelector(selectIsAdmin);
	const userRole = useAppSelector(selectCurrentUserRole);
	const initComplete = useAppSelector(selectInitComplete);
	return { isAdmin, userRole, initComplete };
};

// Overloads to support TS key completions
type TranslateFunction = {
	(messageID: LocaleDataKey): string;
	(messageID: string): string;
}

// usage
// const translate = useTranslate()
// translate('myKey')
export const useTranslate = () => {
	const lang = useAppSelector(selectSelectedLanguage);
	const cache = createIntlCache();
	const messages = localeData[lang];
	const intl = createIntl({ locale: lang, messages }, cache);

	const translate: TranslateFunction = (messageID: LocaleDataKey | string) => {
		return intl.formatMessage(defineMessages({ [messageID]: { id: messageID } })[messageID]);
	};

	return translate;
};

// custom hook that will be reused on all related admin pages
// that want to use the unsaved warning component
export const usePreferences = () => {
	const { data: adminPreferences = defaultAdminState } = preferencesApi.useGetPreferencesQuery();
	const [localAdminPref, setLocalAdminPref] = React.useState<PreferenceRequestItem>(cloneDeep(adminPreferences));
	const [submitPreferences] = preferencesApi.useSubmitPreferencesMutation();
	const [hasChanges, setHasChanges] = React.useState<boolean>(false);

	// mutation will invalidate preferences tag and will be re-fetched.
	// On query response, reset local changes to response
	React.useEffect(() => { setLocalAdminPref(cloneDeep(adminPreferences)); }, [adminPreferences]);
	// Compare the API response against the localState to determine changes
	React.useEffect(() => { setHasChanges(!isEqual(adminPreferences, localAdminPref)); }, [localAdminPref, adminPreferences]);

	const makeLocalChanges = (key: keyof PreferenceRequestItem, value: PreferenceRequestItem[keyof PreferenceRequestItem]) => {
		setLocalAdminPref({ ...localAdminPref, [key]: value });
	};

	const discardChanges = () => {
		setLocalAdminPref(cloneDeep(adminPreferences));
	};

	// Functions for input validation and warnings. Each returns true if the user inputs invalid data into its field
	// Need to be functions due to static reference. If they were booleans they wouldn't update when localAdminPref updates
	const invalidFuncs = {
		readingFreq: (): boolean => {
			const frequency = moment.duration(localAdminPref.defaultMeterReadingFrequency);
			return !frequency.isValid() || frequency.asSeconds() <= 0;
		},
		minDate: (): boolean => {
			const minMoment = moment(localAdminPref.defaultMeterMinimumDate);
			const maxMoment = moment(localAdminPref.defaultMeterMaximumDate);
			return !minMoment.isValid() || !minMoment.isSameOrAfter(MIN_DATE_MOMENT) || !minMoment.isSameOrBefore(maxMoment);
		},
		maxDate: (): boolean => {
			const minMoment = moment(localAdminPref.defaultMeterMinimumDate);
			const maxMoment = moment(localAdminPref.defaultMeterMaximumDate);
			return !maxMoment.isValid() || !maxMoment.isSameOrBefore(MAX_DATE_MOMENT) || !maxMoment.isSameOrAfter(minMoment);
		},
		readingGap: (): boolean => { return Number(localAdminPref.defaultMeterReadingGap) < 0; },

		meterErrors: (): boolean => {
			return Number(localAdminPref.defaultMeterMaximumErrors) < 0
				|| Number(localAdminPref.defaultMeterMaximumErrors) > MAX_ERRORS;
		},

		warningFileSize: (): boolean => {
			return Number(localAdminPref.defaultWarningFileSize) < 0
				|| Number(localAdminPref.defaultWarningFileSize) > Number(localAdminPref.defaultFileSizeLimit);
		},

		fileSizeLimit: (): boolean => {
			return Number(localAdminPref.defaultFileSizeLimit) < 0
				|| Number(localAdminPref.defaultWarningFileSize) > Number(localAdminPref.defaultFileSizeLimit);
		}
	};

	return {
		localAdminPref,
		submitPreferences,
		hasChanges,
		makeLocalChanges,
		discardChanges,
		invalidFuncs
	}
}
