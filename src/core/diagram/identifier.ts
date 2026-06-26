/**
 * Lista de prefixos de código a serem removidos antes da formatação do label
 */
const PREFIXES_TO_REMOVE = [
    'void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
    'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
    'static', 'async', 'await', 'override', 'abstract', 'final',
    'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
    'signed', 'unsigned', 'char', 'import', 'export', 'return'
];

/**
 * Limpa o código bruto, removendo comentários inline, prefixos e sufixos,
 * e retorna um label legível formatado.
 *
 * Exemplo:
 *   "void clickLoginButton();"  → "Click Login Button"
 *   "class Login {}"            → "Login"
 *   "_tryLogin();"              → "Try Login"
 *   "val usuario = getUser();"  → "Val Usuario = Get User"
 */
export function formatCodeToLabel(code: string): string {
    // 1. Remove comentários inline (// ou #)
    let cleaned = code.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove atribuições (= ...) pois queremos só o nome do símbolo
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove sufixos comuns: ();, (), {};, ;
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove prefixos conhecidos (iterativamente, para casos como "public void")
    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES_TO_REMOVE) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    // 5. Extrai o primeiro identificador (palavra) se houver algo após a limpeza
    const match = cleaned.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!match) return '';

    const identifier = match[0];

    // 6. Formata para label legível
    let label = identifier.replace(/^_+/, '');
    label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
    label = label.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    label = label.replace(/[_-]+/g, ' ');
    label = label.replace(/\b\w/g, (char) => char.toUpperCase());
    label = label.trim().replace(/\s+/g, ' ');

    return label;
}

/**
 * Extrai o identificador bruto da linha de código (primeira palavra após limpeza de prefixos/sufixos),
 * sem formatar para label. Retorna null se não encontrar nada.
 *
 * Exemplo: "void clickLoginButton();" → "clickLoginButton"
 */
export function extractIdentifierBelow(lineText: string): string | null {
    // 1. Remove comentários inline
    let cleaned = lineText.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove atribuições (= ...)
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove sufixos comuns
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove prefixos conhecidos iterativamente
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

    // 5. Extrai o primeiro identificador (palavra)
    const match = cleaned.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!match) return null;

    return match[0];
}

/**
 * Mantido para compatibilidade — delega a formatCodeToLabel.
 */
export function toReadableLabel(name: string): string {
    return formatCodeToLabel(name);
}
