import ListEditor from "./ListEditor.jsx";
import {FileDrop} from "./FileDrop.jsx";

export const FastaSearch = ({performSearch, onParsedFileContent}) => {
    return (
        <div>
            <ListEditor performSearch={performSearch}/>
            <FileDrop onParsedFileContent={onParsedFileContent}/>
        </div>
    )
}