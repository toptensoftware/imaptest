const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

let _cidMapper;

const DOMPurify = createDOMPurify(new JSDOM('').window);
DOMPurify.addHook(
    'afterSanitizeAttributes',
    function (currentNode, hookEvent, config) {
        if (currentNode.tagName == 'IMG' && currentNode.src?.startsWith('cid:'))
        {
            currentNode.src = _cidMapper(currentNode.src.substring(4));
        }
        return currentNode;
    }
  );

class Sanitize
{
    static Html(dirty, cidMapper)
    {
        let start = Date.now();
        _cidMapper = cidMapper;
        const clean = DOMPurify.sanitize(dirty);
        _cidMapper = null;

        console.log("Sanitize took", Date.now() - start);
        return clean;   
    }
}

module.exports = Sanitize;