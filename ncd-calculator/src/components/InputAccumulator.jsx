import {Dna, Globe2, X} from 'lucide-react';

export const InputAccumulator = ({
                                     MIN_ITEMS = 4,
                                     selectedItems,
                                     onRemoveItem
                                 }) => {
    return (
        <div className="w-1/2 h-[600px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                    Selected Items ({selectedItems.length}/{MIN_ITEMS} minimum)
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-2">
                    {selectedItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex justify-between items-center p-4 rounded-lg bg-gray-50 border border-gray-200"
                        >
                            {item.type === 'fasta' ? (

                                    <div className="flex items-center gap-3">
                                        <Dna size={18} className={"text-blue-500"}/>
                                        <span className="text-gray-600">{item.label}</span>
                                    </div>
                                ) :
                                (

                                    <div className="flex items-center gap-3">
                                        <Globe2 size={18} className={"text-blue-500"}/>
                                        <span className="text-gray-600">{item.label}</span>
                                    </div>
                                )
                            }
                            <X
                                size={18}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                onClick={() => onRemoveItem(item.id)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>

    )
};
