class FlattenStructure
{
    constructor(struct, format)
    {
        this.format = format;
        this.parts = [];
        this.attachments = [];
        this.related = null;
        this.process(struct);
    }

    process(struct)
    {
        // Don't need unwrapped envelope and body parts
        delete struct.envelope;
        delete struct.body;

        // Attach current related group
        struct.related = this.related;

        // Add self to related group
        if (this.related && struct.id)
        {
            let rel = Object.assign({}, struct);
            delete rel.related;
            delete rel.subparts;
            this.related[struct.id] = rel;
        }

        // Attachment
        if (struct.disposition?.type == "attachment")
        {
            this.attachments.push(struct);

            // Shouldn't have sub-parts
            if (struct.subparts?.length)
                throw new Error("unrecognized body structure (attachment has sub-parts)");

            return;
        }

        // Unwrap related parts, but link through .related property
        if (struct.type == "related")
        {
            let save_related = this.related;
            this.related = {};

            for (let p of struct.subparts)
            {
                this.process(p);
            }

            this.related = save_related;
            return;
        }

        // Alternative - process all paths and pick the preferred one
        if (struct.type == "alternative")
        {
            // Save current parts
            let save_parts = this.parts;

            // Process sub-parts
            let alternatives = [];
            for (let p of struct.subparts)
            {
                // Process alternatives
                this.parts = [];
                this.process(p);
                alternatives.push(this.parts);
            }

            // Restore parts
            this.parts = save_parts;

            // Choose parts
            let parts = FlattenStructure.chooseAlternative(alternatives, this.format);

            // Append the chosen alternative
            this.parts.push(...parts);
            return;
        }

        // Process mixed
        if (struct.type == "mixed" || struct.type == "report")
        {
            for (let p of struct.subparts)
            {
                this.process(p);
            }
            return;
        }

        // When inside a related block, only capture the text
        // parts and ignore everything else
        if (this.related == null || struct.type == "text")
        {
            // Add self as some other form of inline content
            this.parts.push(struct);
        }
    }


    static alternativeType(parts)
    {
        for (let p of parts)
        {
            if (p.subtype == "html")
                return "html";
        }
        return "text";
    }
    
    static chooseAlternative(alternatives, desiredType)
    {
        // No options, return nothing
        if (alternatives.length == 0)
            return [];
    
        // Find best matching alternative
        for (let a of alternatives)
        {
            let at = FlattenStructure.alternativeType(a);
            if (at == desiredType)
                return a;
        }
    
        // Just use the first
        return alternatives[0];
    }
    
}

// Flattens a IMAP message structure, returning:
//
// {
//     parts: []        an array of top-level inline parts that
//                          make up the main message content
//     attachments[]    an array of attachments
// }
//
// Also, each inline part will be adorned with an object map of 
//   of "related" parts keyed on the related part Content-Ids.
function flattenStructure(struct, format)
{
    let fs = new FlattenStructure(struct, format);
    return {
        parts: fs.parts,
        attachments: fs.attachments,
    }
}

module.exports = flattenStructure;