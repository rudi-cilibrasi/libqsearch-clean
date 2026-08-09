import {useEffect, useRef} from "react";
import {useLocation} from "react-router-dom";

const PAGE_TITLES: Readonly<Record<string, string>> = {
    "/": "CompLearn | Normalized Compression Distance",
    "/about": "About | CompLearn",
    "/calculator": "NCD Workbench | CompLearn",
    "/error": "Error | CompLearn",
};

const DEFAULT_TITLE = "CompLearn | Normalized Compression Distance";
const MAIN_CONTENT_ID = "main-content";

export const RouteAccessibility = (): JSX.Element => {
    const location = useLocation();
    const previousPathname = useRef<string | null>(null);

    useEffect(() => {
        document.title = PAGE_TITLES[location.pathname] ?? DEFAULT_TITLE;
        const routeChanged = previousPathname.current !== null
            && previousPathname.current !== location.pathname;
        previousPathname.current = location.pathname;

        if (routeChanged) {
            const mainContent = document.getElementById(MAIN_CONTENT_ID);
            mainContent?.focus({preventScroll: true});
            mainContent?.scrollIntoView?.({block: "start"});
        }
    }, [location.pathname]);

    const focusMainContent = (event: React.MouseEvent<HTMLAnchorElement>): void => {
        const mainContent = document.getElementById(MAIN_CONTENT_ID);
        if (!mainContent) return;

        event.preventDefault();
        mainContent.focus({preventScroll: true});
        mainContent.scrollIntoView?.({block: "start"});
        window.history.replaceState(window.history.state, "", `#${MAIN_CONTENT_ID}`);
    };

    return (
        <a className="skip-link" href={`#${MAIN_CONTENT_ID}`} onClick={focusMainContent}>
            Skip to main content
        </a>
    );
};
