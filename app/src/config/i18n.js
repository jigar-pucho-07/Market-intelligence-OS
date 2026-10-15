// src/config/i18n.js — GENERATED from os.yaml `os.languages` + `translations:`. Do not edit; edit os.yaml.
// STRINGS[lang][english] = translation. A string with no translation renders in English (never blank).
// v4.9 (C9): the kernel's own words (Cancel, Save, Export, Search, page controls, empty states…) ship translated for the common Indian
// languages below, so switching the language at runtime changes the whole screen even when os.yaml only translated its own labels.
// An os.yaml `translations:` entry always wins over these defaults.
export const LANGUAGES = ["en"];
const AUTHORED = {};

const KERNEL = {
  hi: {
    'Cancel': 'रद्द करें', 'Save': 'सहेजें', 'Close': 'बंद करें', 'Export': 'निर्यात', 'Export completed': 'निर्यात पूरा हुआ', 'Search': 'खोजें', 'Filter by': 'फ़िल्टर करें',
    'All': 'सभी', 'Today': 'आज', 'Yesterday': 'कल', '7 days': '7 दिन', '30 days': '30 दिन', 'This month': 'इस महीने', 'Clear': 'साफ़ करें', 'Clear search': 'खोज साफ़ करें',
    'Clear filters': 'फ़िल्टर हटाएँ', 'No matches': 'कोई मिलान नहीं', 'record': 'रिकॉर्ड', 'records': 'रिकॉर्ड', 'selected': 'चयनित', 'Export selected': 'चयनित निर्यात करें',
    'Previous page': 'पिछला पृष्ठ', 'Next page': 'अगला पृष्ठ', 'per page': 'प्रति पृष्ठ', 'Rows per page': 'प्रति पृष्ठ पंक्तियाँ', 'Showing {from} to {to} of {total} entries': '{total} में से {from} से {to} दिखा रहे हैं',
    'No data found': 'कोई डेटा नहीं मिला', 'Select': 'चुनें', 'Please fill': 'कृपया भरें', 'Applies to': 'लागू होगा', 'selected records': 'चयनित रिकॉर्ड पर', 'Notifications': 'सूचनाएँ', 'unread': 'अपठित',
    'Language': 'भाषा', 'More actions': 'और कार्य', 'Open full page': 'पूरा पृष्ठ खोलें', 'Unassigned': 'असाइन नहीं', 'Back': 'वापस', 'Back to': 'वापस', 'Loading': 'लोड हो रहा है', 'Created': 'बनाया गया',
    'Something went wrong': 'कुछ गड़बड़ हो गई', 'Try again': 'फिर कोशिश करें', 'Retry': 'फिर कोशिश करें', 'Showing': 'दिखा रहे हैं', 'Clear filter': 'फ़िल्टर हटाएँ', 'Record a voice note': 'वॉइस नोट रिकॉर्ड करें',
    'This workflow is not connected yet': 'यह वर्कफ़्लो अभी जुड़ा नहीं है', 'We can’t find that page': 'हमें वह पृष्ठ नहीं मिला', 'Go to the home page': 'होम पृष्ठ पर जाएँ',
    'Select all rows on this page': 'इस पृष्ठ की सभी पंक्तियाँ चुनें', 'Select row': 'पंक्ति चुनें',
  },
  gu: {
    'Cancel': 'રદ કરો', 'Save': 'સાચવો', 'Close': 'બંધ કરો', 'Export': 'નિકાસ', 'Export completed': 'નિકાસ પૂર્ણ થઈ', 'Search': 'શોધો', 'Filter by': 'ફિલ્ટર કરો',
    'All': 'બધા', 'Today': 'આજે', 'Yesterday': 'ગઈકાલે', '7 days': '7 દિવસ', '30 days': '30 દિવસ', 'This month': 'આ મહિને', 'Clear': 'સાફ કરો', 'Clear search': 'શોધ સાફ કરો',
    'Clear filters': 'ફિલ્ટર હટાવો', 'No matches': 'કોઈ મેળ નથી', 'record': 'રેકોર્ડ', 'records': 'રેકોર્ડ', 'selected': 'પસંદ કરેલ', 'Export selected': 'પસંદ કરેલ નિકાસ કરો',
    'Previous page': 'પાછલું પૃષ્ઠ', 'Next page': 'આગલું પૃષ્ઠ', 'per page': 'પ્રતિ પૃષ્ઠ', 'Rows per page': 'પ્રતિ પૃષ્ઠ હરોળ', 'Showing {from} to {to} of {total} entries': '{total} માંથી {from} થી {to} બતાવી રહ્યા છીએ',
    'No data found': 'કોઈ ડેટા મળ્યો નથી', 'Select': 'પસંદ કરો', 'Please fill': 'કૃપા કરીને ભરો', 'Applies to': 'લાગુ પડશે', 'selected records': 'પસંદ કરેલ રેકોર્ડ પર', 'Notifications': 'સૂચનાઓ', 'unread': 'વાંચ્યા વગરની',
    'Language': 'ભાષા', 'More actions': 'વધુ ક્રિયાઓ', 'Open full page': 'પૂરું પૃષ્ઠ ખોલો', 'Unassigned': 'સોંપાયેલ નથી', 'Back': 'પાછા', 'Back to': 'પાછા', 'Loading': 'લોડ થઈ રહ્યું છે', 'Created': 'બનાવ્યું',
    'Something went wrong': 'કંઈક ખોટું થયું', 'Try again': 'ફરી પ્રયાસ કરો', 'Retry': 'ફરી પ્રયાસ કરો', 'Showing': 'બતાવી રહ્યા છીએ', 'Clear filter': 'ફિલ્ટર હટાવો', 'Record a voice note': 'વૉઇસ નોટ રેકોર્ડ કરો',
    'This workflow is not connected yet': 'આ વર્કફ્લો હજી જોડાયેલ નથી', 'We can’t find that page': 'અમને તે પૃષ્ઠ મળ્યું નથી', 'Go to the home page': 'હોમ પૃષ્ઠ પર જાઓ',
    'Select all rows on this page': 'આ પૃષ્ઠની બધી હરોળ પસંદ કરો', 'Select row': 'હરોળ પસંદ કરો',
  },
  mr: {
    'Cancel': 'रद्द करा', 'Save': 'जतन करा', 'Close': 'बंद करा', 'Export': 'निर्यात', 'Export completed': 'निर्यात पूर्ण झाले', 'Search': 'शोधा', 'Filter by': 'फिल्टर करा',
    'All': 'सर्व', 'Today': 'आज', 'Yesterday': 'काल', '7 days': '7 दिवस', '30 days': '30 दिवस', 'This month': 'या महिन्यात', 'Clear': 'साफ करा', 'Clear search': 'शोध साफ करा',
    'Clear filters': 'फिल्टर काढा', 'No matches': 'जुळणारे काही नाही', 'record': 'नोंद', 'records': 'नोंदी', 'selected': 'निवडलेले', 'Previous page': 'मागील पान', 'Next page': 'पुढील पान',
    'per page': 'प्रति पान', 'Language': 'भाषा', 'Something went wrong': 'काहीतरी चुकले', 'Try again': 'पुन्हा प्रयत्न करा', 'Retry': 'पुन्हा प्रयत्न करा', 'Loading': 'लोड होत आहे',
  },
};
export const STRINGS = Object.fromEntries(Object.keys(AUTHORED).map((l) => [l, { ...(KERNEL[l] ?? {}), ...AUTHORED[l] }]));
