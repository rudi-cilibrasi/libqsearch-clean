import { Profile as GithubProfile } from "passport-github2";

export interface ExtendedGithubProfile extends GithubProfile {
    _json: object;
}