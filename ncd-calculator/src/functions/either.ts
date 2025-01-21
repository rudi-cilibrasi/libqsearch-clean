
export class Either<L, R> {
  private left: L | null;
  private right: R | null;

  private constructor(left: L | null, right: R | null) {
    this.left = left;
    this.right = right;
  }

  static left<L, R>(value: L): Either<L, R> {
    return new Either<L, R>(value, null);
  }

  static right<L, R>(value: R): Either<L, R> {
    return new Either<L, R>(null, value);
  }

  isLeft(): boolean {
    return this.left != null;
  }

  isRight(): boolean {
    return this.right != null;
  }

  getRight(): R {
    if (this.right === null) {
      throw new Error("Cannot get Right value from Left");
    }
    return this.right;
  }

  getLeft(): L {
    if (this.left === null) {
      throw new Error("Cannot get Left value from Right");
    }
    return this.left;
  }

  getRightOrNull(): R | null {
    return this.right;
  }

  getLeftOrNull(): L | null {
    return this.left;
  }

  map<T>(fn: (value: R) => T): Either<L, T> {
    return this.isRight()
      ? Either.right<L, T>(fn(this.right as R))
      : (this as unknown as Either<L, T>);
  }

  chain<T>(fn: (value: R) => Either<L, T>): Either<L, T> {
    return this.isRight()
      ? fn(this.right as R)
      : (this as unknown as Either<L, T>);
  }

  orElseGet(defaultValue: R): R {
    return this.isRight() ? (this.right as R) : defaultValue;
  }

  fold<T>(leftFn: (left: L) => T, rightFn: (right: R) => T): T {
    return this.isRight() ? rightFn(this.right as R) : leftFn(this.left as L);
  }
}
