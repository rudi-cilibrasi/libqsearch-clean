import ListEditor from "./ListEditor.jsx";
import {FileDrop} from "./FileDrop.jsx";

export const FastaSearch = ({performSearch, handleFastaData}) => {
    return (
        <div>
            <ListEditor performSearch={performSearch}/>
            <FileDrop onFastaData={handleFastaData}/>
        </div>
    )
}