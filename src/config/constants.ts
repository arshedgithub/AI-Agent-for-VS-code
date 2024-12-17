export const SUPPORTED_EXTENSIONS = [
    '.js', '.ts', '.tsx', '.jsx',
    '.py', '.java', '.cpp', '.php',
    '.html', '.css', '.scss', '.xml',
    '.json', '.md'
];

export const EXCLUDED_DIRECTORIES = [
    'node_modules',
    '.git',
    '.github',
    'dist',
    'build',
    'out',
    '.next',
    'coverage',
];

export const EXCLUDED_FILE_PATTERNS = [
    /^\.env\..*/,
    /^\.DS_Store$/,
    /^thumbs\.db$/i,
    /^desktop\.ini$/i
];
