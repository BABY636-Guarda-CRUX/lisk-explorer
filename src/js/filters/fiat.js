angular.module('lisk_explorer')
.filter('fiat', () => amount => {
    if (isNaN(amount)) {
        return (0).toFixed(2);
    } else {
        return (parseInt(amount) / 1e8).toFixed(2);
    }
});