// `slugs` ships no types. The legacy backend uses it to derive piece and
// person slugs, and it is kept so newly created slugs match historical ones.
declare module "slugs" {
    export default function slug(input: string): string;
}
