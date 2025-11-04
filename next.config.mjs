/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    distDir: 'dist',
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
