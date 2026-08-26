const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required for creating an account"],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Invalid email address",
      ],
      unique: [true, "Email already exists"],
    },
    name: {
      type: String,
      required: [true, "Name is required for creating an account"],
    },
    password: {
      type: String,
      required: [true, "Password is required for creating an account"],
      minlength: [6, "Password should be more than 6 characters"],
      select: false,
    },
    systemUser: {
      type: Boolean,
      default: false,
      immutable: true,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Hash the password before every save that touches it.
 *
 * This is an `async` hook, so Mongoose advances the middleware chain when the
 * returned promise settles — returning early is how you skip the work; there
 * is no `next` callback to call.
 */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

/**
 * Compare a plaintext password against this user's bcrypt hash.
 *
 * The document must have been loaded with `.select("+password")`, otherwise
 * `this.password` is `undefined` and the comparison always fails.
 *
 * @param {string} password Plaintext password to check.
 * @returns {Promise<boolean>} `true` when the password matches.
 */
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;
