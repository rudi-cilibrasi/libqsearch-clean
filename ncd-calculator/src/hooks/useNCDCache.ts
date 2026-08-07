import {useEffect, useState} from "react";
import {CompressionCache} from "@/cache/CompressionCache";

export const useNCDCache = () => {
   const [cache] = useState(() => new CompressionCache());
    useEffect(() => {
    }, []);
    return cache;
}
