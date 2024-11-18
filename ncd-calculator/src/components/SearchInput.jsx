import {Search} from "lucide-react";

export const SearchInput = ({addItem, type, label, searchTerm, handleSearchTerm}) => {
    const handlePress = (event) => {
        if (event.key === 'Enter' || event.key === 'Return') {
            event.preventDefault();
            if (type === 'fasta') {
                const input = {
                    type: type,
                    content: '',
                    label: searchTerm,
                    id: searchTerm
                }
                addItem(input);
            }
        }
    }
    return (
        <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
                {label}
            </h3>

            {/* Search Input - Only show for language mode */}
            {/*{searchMode === 'language' && (*/}
            <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <Search size={20} className="text-gray-400"/>
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearchTerm(e.target.value)}
                    onKeyDown={(e) => handlePress(e)}
                    placeholder="Search..."
                    className="w-full py-3 px-4 pl-12 border-2 border-gray-200 rounded-lg text-base outline-none
                           focus:border-blue-500 transition-colors"
                />
            </div>
            {/*)}*/}
        </div>
    )
}