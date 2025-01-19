import { useEffect, useRef } from 'react';
import {LabelManager} from "@/functions/labelUtils.ts";

export function useLabelManager() {
    const labelManager = useRef(LabelManager.getInstance());

    useEffect(() => {
        return () => {
            labelManager.current.clear();
        };
    }, []);

    return labelManager.current;
}