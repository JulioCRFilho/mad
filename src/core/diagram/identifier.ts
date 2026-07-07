//@::graph TD

/**
 * List of code prefixes to be removed before label formatting
 */
const PREFIXES_TO_REMOVE = [
    'void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
    'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
    'static', 'async', 'await', 'override', 'abstract', 'final',
    'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
    'signed', 'unsigned', 'char', 'import', 'export', 'return'
];

/**
 * Cleans the raw code, removing inline comments, prefixes and suffixes,
 * and returns a readable formatted label.
 *
 * Exemplo:
 *   "void clickLoginButton();"  → "Click Login Button"
 *   "class Login {}"            → "Login"
 *   "_tryLogin();"              → "Try Login"
 *   "val usuario = getUser();"  → "Get User"
 */
//@formatCodeToLabel
export function formatCodeToLabel(code: string): string {
    // 0. Remove line breaks and normalize spaces
    let cleaned = code.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    //@formatCodeToLabel1:Strip inline comments
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');
    //@formatCodeToLabel1->formatCodeToLabel2:Proceed to strip assignments

    //@formatCodeToLabel2:Assignment RHS removed
    cleaned = cleaned.replace(/\s*=.*$/, '');

    //@formatCodeToLabel2->formatCodeToLabel3:Strip suffixes
    //@formatCodeToLabel3:Suffixes stripped (parens, braces, semicolon)
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    //@formatCodeToLabel3->formatCodeToLabel4:Strip code prefixes iteratively
    //@formatCodeToLabel4:Prefixes stripped
    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES_TO_REMOVE) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    //@formatCodeToLabel4->formatCodeToLabel5:Strip non-word chars
    //@formatCodeToLabel5:Non-word chars removed
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\s]/g, '');
    
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    
    //@formatCodeToLabel5->formatCodeToLabel6:Detect casing pattern
    //@formatCodeToLabel6:Casing pattern detected (camel/Pascal/snake)
    for (const word of words) {
        const camelCaseMatch = word.match(/^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/);
        const pascalCaseMatch = word.match(/^[A-Z][a-z]+[A-Za-z0-9]*$/);
        const snakeCaseMatch = word.match(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        
        if (camelCaseMatch || pascalCaseMatch || snakeCaseMatch) {
            let label = word;
            
            if (camelCaseMatch) {
                label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
            } else if (pascalCaseMatch) {
                label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
                label = label.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
            } else if (snakeCaseMatch) {
                label = label.replace(/_/g, ' ');
            }
            
            //@formatCodeToLabel6->formatCodeToLabel7:Capitalize words
            //@formatCodeToLabel7:Label capitalized and ready
            label = label.replace(/\b\w/g, (char) => char.toUpperCase());
            
            return label.trim();
        }
    }
    
    // Fallback: return the first word
    if (words.length > 0) {
        return words[0].replace(/_/g, '');
    }
    
    return '';
}

/**
 * Extracts the raw identifier from the code line (first word after cleaning prefixes/suffixes),
 * without formatting to label. Returns null if nothing is found.
 *
 * Exemplo: "void clickLoginButton();" → "clickLoginButton"
 */
//@extractIdentifierBelow
export function extractIdentifierBelow(lineText: string): string | null {
    let cleaned = lineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    //@extractIdentifierBelow1:Strip inline comments
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');
    //@extractIdentifierBelow1->extractIdentifierBelow2:Proceed to strip assignments

    //@extractIdentifierBelow2:Assignment RHS removed
    cleaned = cleaned.replace(/\s*=.*$/, '');

    //@extractIdentifierBelow2->extractIdentifierBelow3:Strip suffixes
    //@extractIdentifierBelow3:Suffixes stripped (parens, braces, semicolon)
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    //@extractIdentifierBelow3->extractIdentifierBelow4:Strip code prefixes iteratively
    //@extractIdentifierBelow4:Prefixes stripped
    const PREFIXES = ['void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
        'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
        'static', 'async', 'await', 'override', 'abstract', 'final',
        'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
        'signed', 'unsigned', 'char', 'import', 'export', 'return', 'new', 'display'];

    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    //@extractIdentifierBelow4->extractIdentifierBelow5:Extract identifier word
    //@extractIdentifierBelow5:Identifier extracted
    const match = cleaned.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!match) return null;

    return match[0];
}

/**
 * Maintained for compatibility — delegates to formatCodeToLabel.
 */
export function toReadableLabel(name: string): string {
    return formatCodeToLabel(name);
}