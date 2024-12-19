import {useEffect, useState} from "react";
import {CRCCache} from "@/cache/CRCCache.ts";

export const useNCDCache = () => {
   const [cache] = useState(() => new CRCCache());
    useEffect(() => {
    }, []);
    return cache;
}