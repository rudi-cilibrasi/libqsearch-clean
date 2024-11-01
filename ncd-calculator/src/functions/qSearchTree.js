export const getTreeInput = ncdOutput => {
    const { labels, ncdMatrix } = ncdOutput;
    let treeInput= '';
    for(let i = 0; i < labels.length; i++) {
       let str = labels[i] + " ";
       let row = ncdMatrix[i];
       for(let j = 0; j < row.length; j++) {
          str += row[j] + " ";
       }
       treeInput += (str.trim()) + "\n";
    }
    return treeInput;
}