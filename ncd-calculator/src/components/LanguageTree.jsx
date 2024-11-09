import React, {useState, useEffect} from 'react';
import {getTranslationResponse, LANGUAGE_NAMES} from '../functions/udhr.js';
import {ChevronRight, X, Info, Loader} from 'lucide-react';
import {cacheTranslation, getTranslationCache} from "../functions/cache.js";

export const LanguageTree = ({ncdWorker, labelMapRef, setLabelMap}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLanguages, setSelectedLanguages] = useState([]);
    const [availableLanguages, setAvailableLanguages] = useState(Object.keys(LANGUAGE_NAMES));
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchDisabled, setIsSearchDisabled] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const MIN_LANGUAGES = 4;

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredLanguages = availableLanguages.filter((languageCode) =>
        LANGUAGE_NAMES[languageCode].toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleLanguage = (languageCode) => {
        let size = 0;
        if (selectedLanguages.includes(languageCode)) {
            const languages = selectedlanguages.filter((code) => code !== languagecode);
            setSelectedLanguages(languages);
            size = languages.length;
        } else {
            const languages = [...selectedLanguages, languageCode];
            setSelectedLanguages(languages);
            size = languages.length;
        }
        if (size >= MIN_LANGUAGES) {
            setIsSearchDisabled(false);
        } else {
            setIsSearchDisabled(true);
        }
    };

    const onPerformSearch = async () => {
        setIsLoading(true);
        setIsProcessing(true);

        const ncdInput = {
            contents: [],
            labels: []
        };

        try {
            for (let i = 0; i < selectedLanguages.length; i++) {
                const lang = selectedLanguages[i];
                const translationCached = getTranslationCache(lang);
                if (translationCached) {
                    ncdInput.labels.push(lang);
                    ncdInput.contents.push(translationCached);
                } else {
                    const text = await getTranslationResponse(lang);
                    if (text && text.trim() !== '') {
                        cacheTranslation(lang, text);
                        ncdInput.labels.push(lang);
                        ncdInput.contents.push(text);
                    }
                }
            }
        } finally {
            setIsLoading(false);
        }
        const labelMap = getDisplayLabelMap(selectedLanguages);
        labelMapRef.current = labelMap;
        setLabelMap(labelMap);
        ncdWorker.postMessage(ncdInput);
    };

    useEffect(() => {
        const handleWorkerMessage = () => {
            setIsProcessing(false);
        };

        ncdWorker.addEventListener('message', handleWorkerMessage);
        return () => ncdWorker.removeEventListener('message', handleWorkerMessage);
    }, [ncdWorker]);

    const getDisplayLabelMap = (languages) => {
        const map = new Map();
        for (let i = 0; i < languages.length; i++) {
            const lang = LANGUAGE_NAMES[languages[i]];
            map.set(languages[i], lang);
        }
        return map;
    }

    return (
        <div className="p-5 w-full">
            {/* Info Panel */}
            <div className="w-[60vw] mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20}/>
                <div>
                    <p className="m-0 text-slate-700 leading-relaxed text-[0.95rem]">
                        Explore language relationships through the <strong>Universal Declaration of Human Rights
                        (UDHR)</strong>.
                        This tool uses NCD (Normalized Compression Distance) to analyze and visualize similarities
                        between different language translations.
                        <strong> Please select at least {MIN_LANGUAGES} languages</strong> to generate a meaningful
                        Quartet Tree visualization.
                        {selectedLanguages.length > 0 && (
                            <span className="ml-2">
                                ({selectedLanguages.length}/{MIN_LANGUAGES} languages selected)
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex gap-6 w-[60vw]">
                {/* Left Panel - Available Languages */}
                <div className="w-1/2 h-[500px] border border-slate-200 p-6 rounded-xl bg-white">
                    <h3 className="text-lg font-bold mb-5 text-slate-900">Available Languages</h3>
                    <div className="relative mb-5">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleInputChange}
                            placeholder="Search languages..."
                            className="w-full p-3 pl-6 border-2 border-slate-200 rounded-lg text-base outline-none
                                     focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto p-1">
                        {filteredLanguages.map((languageCode) => (
                            <div
                                key={languageCode}
                                onClick={() => toggleLanguage(languageCode)}
                                className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200
                                         rounded-lg cursor-pointer hover:bg-slate-100 transition-all"
                            >
                                <div className="text-slate-700">{LANGUAGE_NAMES[languageCode]}</div>
                                <ChevronRight size={20} className="text-slate-400"/>
                            </div>
                        ))}
                        {filteredLanguages.length === 0 && (
                            <div className="text-center p-4 text-slate-500">
                                No languages found matching "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Selected Languages */}
                <div className="w-1/2 h-[500px] border border-slate-200 p-6 rounded-xl bg-white">
                    <h3 className="text-lg font-bold mb-5 text-slate-900">
                        Selected Languages ({selectedLanguages.length})
                    </h3>
                    <div className="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto p-1">
                        {selectedLanguages.map((languageCode) => (
                            <div
                                key={languageCode}
                                className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-lg"
                            >
                                <div className="text-slate-500 text-sm">{LANGUAGE_NAMES[languageCode]}</div>
                                <X
                                    size={20}
                                    className="text-slate-400 cursor-pointer hover:text-slate-600"
                                    onClick={() => toggleLanguage(languageCode)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="w-[60vw] flex items-center justify-end mt-6 mb-6 gap-6">
                {(isLoading || isProcessing) && (
                    <div className="flex items-center gap-2 text-slate-600" style={{
                        color: "#bfdbfe"
                    }}>
                        <Loader className="animate-spin" size={20}/>
                        <span>{isLoading ? 'Loading translations...' : 'Processing results...'}</span>
                    </div>
                )}
                <button
                    onClick={onPerformSearch}
                    disabled={isSearchDisabled}
                    className={`px-6 py-3 text-base rounded-lg border-none shadow-md transition-all
                              ${isSearchDisabled
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'}`}
                >
                    Show Tree
                </button>
            </div>
        </div>
    );
};
