package com.ruralhealth.service;

import com.ruralhealth.dto.request.UpdateProfileRequest;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.UserResponse;
import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.User;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private static final int MAX_PAGE_SIZE = 50;

    private final UserRepository users;

    public UserService(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public UserResponse getById(Long id) {
        return UserResponse.from(find(id));
    }

    @Transactional
    public UserResponse updateProfile(Long id, UpdateProfileRequest req) {
        User user = find(id);
        user.setName(req.name().trim());
        user.setPhone(req.phone());
        if (req.language() != null) {
            user.setLanguage(req.language());
        }
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateLanguage(Long id, String language) {
        User user = find(id);
        user.setLanguage(language);
        return UserResponse.from(user);
    }

    // ---- admin operations ----

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> list(Role role, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "id"));
        Page<User> result = role == null ? users.findAll(pr) : users.findByRole(role, pr);
        return PageResponse.from(result, UserResponse::from);
    }

    @Transactional
    public UserResponse setEnabled(Long targetId, boolean enabled, Long actingAdminId) {
        if (targetId.equals(actingAdminId) && !enabled) {
            throw new BadRequestException("CANNOT_DISABLE_SELF", "You cannot disable your own account.");
        }
        User user = find(targetId);
        user.setEnabled(enabled);
        log.info("Admin {} set user {} enabled={}", actingAdminId, targetId, enabled);
        return UserResponse.from(user);
    }

    private User find(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User not found."));
    }
}
