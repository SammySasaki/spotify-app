export const catchErrors = fn => {
    return function(...args) {
        return fn(...args).catch((err) => {
            console.error(err);
        })
    }
};

// random number between 0 and max inclusive
export const rNG = function(max) {
    return Math.floor(Math.random() * (max + 1));
}