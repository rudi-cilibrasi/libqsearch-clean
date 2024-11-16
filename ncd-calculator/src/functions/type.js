// either an error [left] or value [right]
export class Either {
    constructor(left, right) {
        this.left = left;
        this.right = right;
    }

    static left(value) {
        return new Either(value, null);
    }

    static right(value) {
        return new Either(null, value);
    }

    isLeft() {
        return this.left != null;
    }

    isRight() {
        return this.right != null;
    }

    map(fn) {
        return this.isRight() ? Either.right(fn(this.right)) : this;
    }

    chain(fn) {
        return this.isRight() ? fn(this.right) : this;
    }

    orElseGet(defaultValue) {
        return this.isRight ? this.right : defaultValue;
    }

    fold(leftFn, rightFn) {
        return this.isRight() ? rightFn(this.right)  : leftFn(this.left);
    }
}
