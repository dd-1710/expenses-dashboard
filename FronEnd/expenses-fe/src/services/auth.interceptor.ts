import { HttpInterceptorFn } from "@angular/common/http";

export const authInterceptor: HttpInterceptorFn = (req, next) => {

    const token = sessionStorage.getItem('token') || '';
    if (token) {
        const reqClone = req.clone({
            setHeaders: { Authorization: 'Bearer                                                                                                ' + token }
        })
        return next(reqClone);
    }
    return next(req);
}